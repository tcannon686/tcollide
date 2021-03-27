import { Vector3, Matrix4, Matrix3 } from 'three'
import { kdTree } from './src/kdtree.js'
import { Subject, BehaviorSubject } from 'rxjs'
import { sample } from 'rxjs/operators'

import { transformable } from './src/shapes'

export * from './src/shapes'

/**
 * Returns an object that can be added to the scene, built with the given
 * support functions. For each supplied support function, a new support function
 * is created, with an additional `body` field, which points to the returned
 * body.
 *
 * The returned object looks like this:
 * {
 *   supports: [], // An array of support functions, each with a body field
 *                 // pointing to the returned object.
 *   transform: new Matrix4(), // The current transformation
 *   update (), // Updates the objects bounding box in the scene
 *   position, // The current position. Set the position using transform and
 *             // then calling update().
 *   beginOverlap, // An RxJS Subject that emits an object: { support, other,
 *                 // amount }
 *   endOverlap, // An RxJS Subject that emits an object: { support, other,
 *               // amount }
 *   isKinematic // Whether the object should be affected by physics.
 * }
 */
export function body ({ supports, isKinematic }) {
  const transform = new Matrix4()
  const transformInverse = new Matrix3()
  const changed = new BehaviorSubject()
  const position = new Vector3(0, 0, 0)
  const velocity = new Vector3(0, 0, 0)

  const beginOverlap = new Subject()
  const stayOverlap = new Subject()
  const endOverlap = new Subject()

  const ret = {
    update () {
      transformInverse.setFromMatrix4(transform)
      transformInverse.transpose()
      position.setFromMatrixPosition(transform)
      changed.next()
    },
    position,
    transform,
    changed,
    beginOverlap,
    endOverlap,
    stayOverlap,
    velocity,
    isKinematic
  }
  ret.supports = supports.map(x => {
    const f = transformable(
      x,
      (d) => {
        d.applyMatrix4(transform)
      },
      (d) => {
        d.applyMatrix3(transformInverse)
      })
    f.body = ret
    return f
  })
  return ret
}

/**
 * Returns a scene object. The scene efficiently handles collisions for multiple
 * bodies, and supports the overlap events for bodies.
 *
 * To check for overlaps, call the update() method of the returned scene object.
 * This will then emit the beginOverlap, endOverlap, and stayOverlap subjects
 * for each body that overlaps another body. It also has a `overlapped` subject,
 * which emits an object { support, other, amount } when two bodies overlap.
 * This object is emitted only once per pair.
 *
 * The scene has the following fields:
 *  - add (bodys)
 *  - remove (body)
 *  - update ()
 *  - overlapped - RxJS Subject that emits { support, other, amount } when two
 *                 objects overlap.
 */
export function collisionScene () {
  const bodies = []
  let subscriptions = []
  let updates = null

  const overlapped = new Subject()
  
  const onOverlap = (support, other, amount) => {
    overlapped.next({ support, other, amount })
  }

  const onBeginOverlap = (support, other, amount) => {
    support.body.beginOverlap.next({
      support,
      other,
      amount: amount.clone()
    })
    other.body.beginOverlap.next({
      support: other,
      other: support,
      amount: amount.clone().negate()
    })
  }
  const onEndOverlap = (support, other) => {
    support.body.endOverlap.next({
      support,
      other
    })
    other.body.endOverlap.next({
      support: other,
      other: support
    })
  }
  const onStayOverlap = (support, other, amount) => {
    if (support.body.stayOverlap.observers.length > 0) {
      support.body.stayOverlap.next({
        support,
        other,
        amount: amount.clone()
      })
    }
    if (other.body.stayOverlap.observers.length > 0) {
      other.body.stayOverlap.next({
        support: other,
        other: support,
        amount: amount.clone().negate()
      })
    }
  }

  const makeTree = () => (
    kdTree(bodies.flatMap(x => x.supports), {
      onBeginOverlap,
      onEndOverlap,
      onStayOverlap,
      onOverlap
    })
  )

  const updated = new Subject()

  const updateTree = () => {
    subscriptions.forEach(x => { x.unsubscribe() })
    updates = makeTree()
    subscriptions = bodies.map((x, i) => (
      x.changed.pipe(
        sample(updated)
      ).subscribe(updates[i])
    ))
  }

  let shouldUpdateTree = false

  return {
    add (body) {
      bodies.push(body)
      shouldUpdateTree = true
    },
    remove (body) {
      bodies.splice(bodies.indexOf(body), 1)
      shouldUpdateTree = true
    },
    update () {
      if (shouldUpdateTree) {
        updateTree()
        shouldUpdateTree = false
      }
      updated.next()
    },
    overlapped
  }
}

/**
 * Creates a scene with very basic physics.
 *
 * The returned object has the following fields:
 *  - add (body)
 *  - remove (body)
 *  - update (dt)
 */
export function scene () {
  const cScene = collisionScene()
  const dynamicBodies = []
  const gravity = new Vector3(0, -9.8, 0)

  const normal = new Vector3()
  const onOverlap = ({ support, other, amount }) => {
    const a = support
    const b = other
    if (amount.lengthSq() > 0) {
      normal.copy(amount).normalize()

      /* Handle collisions. */
      if (!a.body.isKinematic && !b.body.isKinematic) {
        a.body.position.addScaledVector(amount, -0.5)
        a.body.transform.setPosition(a.body.position)
        b.body.position.addScaledVector(amount, 0.5)
        b.body.transform.setPosition(b.body.position)
        a.body.update()
        b.body.update()
      } else if (!b.body.isKinematic) {
        b.body.position.add(amount)
        b.body.transform.setPosition(b.body.position)
        b.body.update()
      } else if (!a.body.isKinematic) {
        a.body.position.addScaledVector(amount, -1.0)
        a.body.transform.setPosition(a.body.position)
        a.body.update()
      }

      /* Adjust velocities. */
      if (!a.body.isKinematic) {
        a.body.velocity.addScaledVector(normal, -a.body.velocity.dot(normal))
        /* Apply friction. TODO change constant. */
        a.body.velocity.addScaledVector(a.body.velocity, -0.1)
      }
      if (!b.body.isKinematic) {
        b.body.velocity.addScaledVector(normal, -b.body.velocity.dot(normal))
        /* Apply friction. TODO change constant. */
        b.body.velocity.addScaledVector(b.body.velocity, -0.1)
      }
    }
  }

  cScene.overlapped.subscribe(onOverlap)

  return {
    add (body) {
      if (!body.isKinematic) {
        dynamicBodies.push(body)
      }
      cScene.add(body)
    },
    remove (body) {
      if (!body.isKinematic) {
        dynamicBodies.splice(dynamicBodies.indexOf(body), 1)
      }
      cScene.remove(body)
    },
    update (dt) {
      dynamicBodies.forEach(body => {
        body.position.addScaledVector(body.velocity, dt || 0.0)
        body.velocity.addScaledVector(gravity, dt || 0.0)
        body.transform.setPosition(body.position)
        body.update()
      })
      cScene.update()
    }
  }
}
