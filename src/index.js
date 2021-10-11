import { Vector3, Matrix4, Matrix3 } from 'three'
import { kdTree } from './kdtree.js'
import { Subject, BehaviorSubject } from 'rxjs'
import { sample } from 'rxjs/operators'
import { profiler, createProfiler } from './profile'

import { transformable } from './shapes'

export * from './shapes'
export { profiler, createProfiler }

/**
 * @property {Vector3} amount
 * @property {BodySupport} support
 * @property {BodySupport} other
 * @typedef {Object} OverlapInfo
 */

/**
 * A Support that is paired with a body.
 *
 * @typedef {Support} BodySupport
 */

/**
 * A transformable collection of shapes.
 *
 * @typedef {Object} Body
 * @property {BodySupport[]} supports - An array of support functions, each
 *                                      with a body field pointing to the
 *                                      returned object
 * @property {Matrix4} transform - The current transformation
 * @property {Function} update - Updates the objects bounding box in the scene
 * @property {Vector3} position - The current position. Set the position using
 *                                transform and then calling update()
 * @property {Vector3} velocity - The current velocity
 * @property {Subject} isKinematic - Whether the object should be affected by physics
 */

const privateMaps = {
  beginOverlap: new WeakMap(),
  stayOverlap: new WeakMap(),
  endOverlap: new WeakMap(),
  overlap: new WeakMap(),
  changed: new WeakMap(),
  bodyOf: new WeakMap()
}

/**
 * Returns an RxJS observable that emits any time the given body changes.
 *
 * @param {Body} body
 */
export function changed(body) {
  return privateMaps.changed.get(body).asObservable()
}

/**
 * Returns an RxJS observable that emits an OverlapInfo object any time the
 * given body collides with another body.
 *
 * @param {Body} body
 */
export function beginOverlap(body) {
  return privateMaps.beginOverlap.get(body).asObservable()
}

/**
 * Returns an RxJS observable that emits an OverlapInfo object when the given
 * body stops colliding with another body.
 *
 * @param {Body} body
 */
export function endOverlap(body) {
  return privateMaps.endOverlap.get(body).asObservable()
}

/**
 * Returns an RxJS observable that emits an OverlapInfo object while the given
 * body is overlapping another body.
 *
 * @param {Body} body
 */
export function stayOverlap(body) {
  return privateMaps.stayOverlap.get(body).asObservable()
}

/**
 * Returns an RxJS observable that emits an OverlapInfo any time two objects in
 * the scene are overlapping.
 *
 * @param {Scene} scene
 */
export function overlap(scene) {
  return privateMaps.overlap.get(scene).asObservable()
}

/**
 * Returns an object that can be added to the scene, built with the given
 * support functions. For each supplied support function, a new support function
 * is created, with an additional `body` field, which points to the returned
 * body.
 *
 * @param {Support[]} props.supports - A set of support functions.
 * @param {Boolean} props.isKinematic - Whether the body should move based on
 *                                      the physics simulation or not.
 * @returns {Body}
 */
export function body ({ supports, isKinematic }) {
  const transform = new Matrix4()
  const transformInverse = new Matrix3()
  const position = new Vector3(0, 0, 0)
  const velocity = new Vector3(0, 0, 0)

  const ret = {
    update () {
      transformInverse.setFromMatrix4(transform)
      transformInverse.transpose()
      position.setFromMatrixPosition(transform)
      privateMaps.changed.get(ret).next()
    },
    position,
    transform,
    velocity,
    isKinematic
  }

  privateMaps.beginOverlap.set(ret, new Subject())
  privateMaps.stayOverlap.set(ret, new Subject())
  privateMaps.endOverlap.set(ret, new Subject())
  privateMaps.changed.set(ret, new BehaviorSubject())

  ret.supports = supports.map(x => {
    const f = transformable(
      x,
      (d) => {
        d.applyMatrix4(transform)
      },
      (d) => {
        d.applyMatrix3(transformInverse)
      })
    privateMaps.bodyOf.set(f, ret)
    return f
  })
  return Object.freeze(ret)
}

/**
 * Returns the body that the given support is attached too, or null if it is not
 * attached to any body.
 *
 * @param {BodySupport} support
 * @returns {Body}
 */
export function bodyOf (support) {
  return privateMaps.bodyOf.get(support) || null
}

/**
 * @property {Function} add - Add a body to the scene
 * @property {Function} remove - Remove a body from the scene
 * @property {Function} update - Update the scene, trigger events
 * @typedef CollisionScene
 */

/**
 * Returns a scene object. The scene efficiently handles collisions for multiple
 * bodies, and supports the overlap events for bodies.
 *
 * To check for overlaps, call the update() method of the returned scene object.
 * This will then emit the beginOverlap, endOverlap, and stayOverlap subjects
 * for each body that overlaps another body. It also has a `overlapped` subject,
 * which emits an OverlapInfo object when two bodies overlap. This object is
 * emitted only once per pair.
 *
 * @param {Number} props.tolerance - Tolerance for GJK and EPA algorithms.
 *                                   Reduce this number to increase precision
 *                                   (default 0.001)
 * @returns {CollisionScene}
 */
export function collisionScene ({ tolerance }) {
  tolerance = tolerance || 0.001
  const bodies = []
  const subscriptions = new WeakMap()

  const onOverlap = (support, other, amount) => {
    privateMaps.overlap.get(ret).next({ support, other, amount })
  }

  const onBeginOverlap = (support, other, amount) => {
    privateMaps.beginOverlap.get(bodyOf(support)).next({
      support,
      other,
      amount: amount.clone()
    })
    privateMaps.beginOverlap.get(bodyOf(other)).next({
      support: other,
      other: support,
      amount: amount.clone().negate()
    })
  }
  const onEndOverlap = (support, other) => {
    privateMaps.endOverlap.get(bodyOf(support)).next({
      support,
      other
    })
    privateMaps.endOverlap.get(bodyOf(other)).next({
      support: other,
      other: support
    })
  }
  const onStayOverlap = (support, other, amount) => {
    if (privateMaps.stayOverlap.get(bodyOf(support)).observers.length > 0) {
      privateMaps.stayOverlap.get(bodyOf(support)).next({
        support,
        other,
        amount: amount.clone()
      })
    }
    if (privateMaps.stayOverlap.get(bodyOf(other)).observers.length > 0) {
      privateMaps.stayOverlap.get(bodyOf(other)).next({
        support: other,
        other: support,
        amount: amount.clone().negate()
      })
    }
  }

  const tree = kdTree({
    onBeginOverlap,
    onEndOverlap,
    onStayOverlap,
    onOverlap
  }, tolerance)

  const updated = new Subject()

  const ret = Object.freeze({
    add (body) {
      bodies.push(body)
      body.supports.forEach(support => {
        /* Subscribe to update events. */
        subscriptions.set(
          support,
          changed(body).pipe(
            sample(updated)
          ).subscribe(tree.add(support))
        )
      })
    },
    remove (body) {
      bodies.splice(bodies.indexOf(body), 1)
      /* Unsubscribe from update events. */
      body.supports.forEach(support => {
        tree.remove(support)
        const subscription = subscriptions.get(support)
        if (subscription) {
          subscription.unsubscribe()
        }
      })
    },
    update () {
      updated.next()
    }
  })

  privateMaps.overlap.set(ret, new Subject())
  return ret
}

/**
 * @property {Function} add - Add a Body to the scene
 * @property {Function} remove - Remove a Body from the scene
 * @property {Function} update - Update the scene given dt, the delta time in
 *                               seconds
 * @typedef Scene
 */

/**
 * Creates a scene with very basic physics.
 *
 * @param {Number[]} props.gravity - Acceleration due to gravity
 *                                  (default [0, -9.8, 0])
 * @param {Number} props.tolerance - Tolerance for GJK and EPA algorithms.
 *                                   Reduce this number to increase precision
 *                                   (default 0.001)
 * @returns {Scene}
 */
export function scene ({ gravity, tolerance }) {
  const cScene = collisionScene({ tolerance })
  const dynamicBodies = []
  gravity = new Vector3(...(gravity || [0, -9.8, 0]))

  const normal = new Vector3()
  const onOverlap = ({ support, other, amount }) => {
    const a = support
    const b = other
    if (amount.lengthSq() > 0) {
      normal.copy(amount).normalize()

      /* Handle collisions. */
      if (!bodyOf(a).isKinematic && !bodyOf(b).isKinematic) {
        bodyOf(a).position.addScaledVector(amount, -0.5)
        bodyOf(a).transform.setPosition(bodyOf(a).position)
        bodyOf(b).position.addScaledVector(amount, 0.5)
        bodyOf(b).transform.setPosition(bodyOf(b).position)
        bodyOf(a).update()
        bodyOf(b).update()
      } else if (!bodyOf(b).isKinematic) {
        bodyOf(b).position.add(amount)
        bodyOf(b).transform.setPosition(bodyOf(b).position)
        bodyOf(b).update()
      } else if (!bodyOf(a).isKinematic) {
        bodyOf(a).position.addScaledVector(amount, -1.0)
        bodyOf(a).transform.setPosition(bodyOf(a).position)
        bodyOf(a).update()
      }

      /* Adjust velocities. */
      if (!bodyOf(a).isKinematic) {
        bodyOf(a).velocity.addScaledVector(
          normal,
          -bodyOf(a).velocity.dot(normal))
        /* Apply friction. TODO change constant. */
        bodyOf(a).velocity.addScaledVector(bodyOf(a).velocity, -0.1)
      }
      if (!bodyOf(b).isKinematic) {
        bodyOf(b).velocity.addScaledVector(
          normal,
          -bodyOf(b).velocity.dot(normal))
        /* Apply friction. TODO change constant. */
        bodyOf(b).velocity.addScaledVector(bodyOf(b).velocity, -0.1)
      }
    }
  }

  const ret = Object.freeze({
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
  })

  privateMaps.overlap.set(ret, privateMaps.overlap.get(cScene))
  overlap(ret).subscribe(onOverlap)

  return ret
}
