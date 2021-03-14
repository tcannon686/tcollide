import { Vector3, Matrix4 } from 'three'
import assert from 'assert'
import { kdTree } from './kdtree.js'
import { Subject, BehaviorSubject } from 'rxjs'
import { sample } from 'rxjs/operators'

function makeTriangle (ia, ib, ic, vertices) {
  const ac = vertices[ic].clone().sub(vertices[ia])
  const bc = vertices[ic].clone().sub(vertices[ib])
  const normal = ac.cross(bc)

  if (normal.lengthSq() === 0) {
    return null
  }
  normal.normalize()

  const distance = normal.dot(vertices[ic])

  return {
    ia,
    ib,
    ic,
    normal,
    distance
  }
}

function randomizeDirection (d) {
  do {
    d.set(
      Math.random() - Math.random(),
      Math.random() - Math.random(),
      Math.random() - Math.random()
    )
  } while (d.lengthSq() === 0)
  d.normalize()
}

const nearestSimplex = new Array(5)
nearestSimplex[1] = function (s, d) {
  assert(s.length === 1)
  d.copy(s[0]).negate()
  return d.lengthSq() === 0
}

nearestSimplex[2] = function (s, d) {
  assert(s.length === 2)
  const ab = s[1].clone().sub(s[0])
  if (ab.dot(s[1]) <= 0) {
    s.shift()
    d.copy(s[0]).negate()
  } else {
    d.copy(s[0]).cross(ab).cross(ab)
  }
  return d.lengthSq() === 0
}

nearestSimplex[3] = function (s, d) {
  assert(s.length === 3)
  const ac = s[2].clone().sub(s[0])
  const bc = s[2].clone().sub(s[1])
  const abc = ac.clone().cross(bc)

  const acn = ac.clone().cross(abc)
  const bcn = abc.clone().cross(bc)

  assert(d.dot(s[2]) >= d.dot(s[0]) && d.dot(s[2]) >= d.dot(s[1]))

  if (acn.dot(s[2]) <= 0) {
    if (bcn.dot(s[2]) <= 0) {
      if (abc.dot(s[2]) <= 0) {
        d.copy(abc)
        return false
      } else {
        d.copy(abc).negate()
        s.reverse()
        return false
      }
    } else {
      if (bc.dot(s[2]) <= 0) {
        s.splice(0, 2)
        d.copy(s[0]).negate()
        return false
      } else {
        s.shift()
        d.copy(s[0]).cross(bc).cross(bc)
        return false
      }
    }
  } else if (bcn.dot(s[2]) <= 0) {
    if (ac.dot(s[2]) <= 0) {
      s.splice(0, 2)
      d.copy(s[0]).negate()
      return false
    } else {
      s.splice(1, 1)
      d.copy(s[0]).cross(ac).cross(ac)
      return false
    }
  } else {
    s.splice(0, 2)
    d.copy(s[0]).negate()
    return false
  }
}

nearestSimplex[4] = function (s, d) {
  assert(s.length === 4)

  const ad = s[3].clone().sub(s[0])
  const bd = s[3].clone().sub(s[1])
  const cd = s[3].clone().sub(s[2])

  const abd = bd.clone().cross(ad)
  const bcd = cd.clone().cross(bd)
  const cad = ad.clone().cross(cd)

  assert(
    d.dot(s[3]) >= d.dot(s[0]) &&
    d.dot(s[3]) >= d.dot(s[1]) &&
    d.dot(s[3]) >= d.dot(s[2])
  )

  const specialCase = (s1, s2) => {
    const d1 = new Vector3()
    const d2 = new Vector3()

    nearestSimplex[3](s1, d1)
    nearestSimplex[3](s2, d2)

    const l1 = -d1.dot(s[3]) / d1.length()
    const l2 = -d2.dot(s[3]) / d2.length()

    if (l1 < l2) {
      d.copy(d1)
      s.splice(0, 4, ...s1)
    } else {
      d.copy(d2)
      s.splice(0, 4, ...s2)
    }
  }

  if (abd.dot(s[3]) <= 0) {
    if (bcd.dot(s[3]) <= 0) {
      if (cad.dot(s[3]) <= 0) {
        return true
      } else {
        s[1] = s[0]
        s[0] = s[2]
        s[2] = s[3]
        s.pop()
        return nearestSimplex[3](s, d)
      }
    } else {
      if (cad.dot(s[3]) <= 0) {
        s.shift()
        return nearestSimplex[3](s, d)
      } else {
        specialCase([s[1], s[2], s[3]], [s[2], s[0], s[3]])
        return false
      }
    }
  } else if (bcd.dot(s[3]) <= 0) {
    if (cad.dot(s[3]) <= 0) {
      s[2] = s.pop()
      return nearestSimplex[3](s, d)
    } else {
      specialCase([s[0], s[1], s[3]], [s[2], s[0], s[3]])
      return false
    }
  } else {
    specialCase([s[0], s[1], s[3]], [s[1], s[2], s[3]])
    return false
  }
}

export function gjk (
  aSupport,
  bSupport,
  d = new Vector3(1, 0, 0),
  s = [],
  tolerance = 0.001
) {
  const a = new Vector3()
  const b = new Vector3()
  while (true) {
    a.copy(d)
    b.copy(d).negate()
    aSupport(a)
    bSupport(b)
    a.sub(b)

    if (a.dot(d) < tolerance) {
      return false
    }

    /* Add to the simplex. */
    s.push(a.clone())

    if (nearestSimplex[s.length](s, d)) {
      return true
    }
    d.normalize()
  }
}

export function epa (
  out,
  aSupport,
  bSupport,
  triangles,
  vertices,
  tolerance = 0.01
) {
  const a = new Vector3()
  const b = new Vector3()

  const edgeCounts = new Map()

  const incEdge = (a, b) => {
    /*
     * Maximum safe integer is 2**53, so we shift by half of 53 to create a key.
     * If a vertex index is greater than 2**26, we got other problems ;).
     */
    const key1 = a + (b * 0x4000000)
    const key2 = b + (a * 0x4000000)
    if (edgeCounts.has(key2)) {
      edgeCounts.set(key2, edgeCounts.get(key2) + 1)
    } else {
      edgeCounts.set(key1, (edgeCounts.get(key1) || 0) + 1)
    }
  }

  let nearest

  while (true) {
    edgeCounts.clear()

    /* Find the closest triangle. */
    nearest = triangles.reduce((m, x) => (
      x.distance < m.distance ? x : m
    ))

    a.copy(nearest.normal)
    b.copy(nearest.normal)
    b.negate()
    aSupport(a)
    bSupport(b)
    a.sub(b)

    if (a.dot(nearest.normal) - nearest.distance > tolerance) {
      for (let i = 0; i < triangles.length; i++) {
        const t = triangles[i]
        if (a.clone().sub(vertices[t.ia]).dot(t.normal) >= 0) {
          incEdge(t.ia, t.ib)
          incEdge(t.ib, t.ic)
          incEdge(t.ic, t.ia)
          /* Remove the triangle. */
          triangles.splice(i, 1)
          i--
        }
      }

      /* Add the new vertex. */
      vertices.push(a.clone())

      /* Create new faces from non-shared edges. */
      for (const key of edgeCounts.keys()) {
        if (edgeCounts.get(key) === 1) {
          const e0 = key & 0x3ffffff
          const e1 = Math.floor(key / 0x4000000)
          const tri = (
            makeTriangle(
              e0,
              e1,
              vertices.length - 1,
              vertices
            )
          )
          /* If we somehow get a triangle with zero area, break. */
          if (!tri) {
            out.copy(nearest.normal).multiplyScalar(nearest.distance)
            return
          }
          triangles.push(tri)
        }
      }
    } else {
      break
    }
  }
  out.copy(nearest.normal).multiplyScalar(nearest.distance)
}

/**
 * Returns true if aSupport is overlapping bSupport. Stores the amount of
 * overlap in the vector out. In other words, after the function executes, if
 * aSupport was moved by -out, the two shapes would no longer be colliding.
 */
export function getOverlap (
  out,
  aSupport,
  bSupport,
  initialAxis = new Vector3(1, 0, 0)
) {
  const s = []
  const d = new Vector3().copy(initialAxis)

  if (gjk(aSupport, bSupport, d, s)) {
    /* Create a triangular mesh for the simplex. */
    const triangles = []
    const vertices = s

    /* Add extra vertices if needed. */
    if (vertices.length <= 2) {
      const a = new Vector3(0, 0, 0)
      const b = new Vector3(0, 0, 0)
      do {
        randomizeDirection(d)
        a.copy(d)
        b.copy(d)
        b.negate()
        aSupport(a)
        bSupport(b)
        a.sub(b)
      } while (vertices.find(x => x.equals(a)))

      vertices.push(a)
    }

    if (vertices.length === 3) {
      const t = makeTriangle(0, 2, 1, vertices)
      const a = new Vector3().copy(t.normal).negate()
      const b = new Vector3().copy(t.normal)
      aSupport(a)
      bSupport(b)
      a.sub(b)
      if (vertices.find(x => x.equals(a))) {
        t.normal.negate()
        const tmp = vertices[0]
        vertices[0] = vertices[2]
        vertices[2] = tmp
        a.copy(t.normal).negate()
        b.copy(t.normal)
        aSupport(a)
        bSupport(b)
        a.sub(b)
      }
      vertices.push(a)
    }

    triangles.push(makeTriangle(0, 2, 1, vertices))
    triangles.push(makeTriangle(0, 1, 3, vertices))
    triangles.push(makeTriangle(1, 2, 3, vertices))
    triangles.push(makeTriangle(2, 0, 3, vertices))

    epa(out, aSupport, bSupport, triangles, vertices)

    /* Remove negative zeros. */
    out.x = out.x || 0.0
    out.y = out.y || 0.0
    out.z = out.z || 0.0
    return true
  }
  return false
}

/**
 * Returns a sphere support function given the position and radius.
 */
export function sphere ({
  position,
  radius
}) {
  const p = position ? new Vector3(...position) : new Vector3(0, 0, 0)
  const r = radius || 1.0
  return (d) => (
    d.normalize().multiplyScalar(r).add(p)
  )
}

/**
 * Returns a box support function given the position and size.
 */
export function box ({
  position,
  size
}) {
  const p = position || [0, 0, 0]
  const s = size || [1, 1, 1]
  return (d) => (
    d.set(
      p[0] + s[0] * (d.x < 0 ? -0.5 : 0.5),
      p[1] + s[1] * (d.y < 0 ? -0.5 : 0.5),
      p[2] + s[2] * (d.z < 0 ? -0.5 : 0.5)
    )
  )
}

/**
 * Returns a point support function given its position.
 */
export function point (x, y, z) {
  return (d) => {
    d.set(x, y, z)
  }
}

/**
 * Returns a support function that is a combination of the given support
 * functions.
 */
export function hull (supports) {
  const v = new Vector3()
  const best = new Vector3()
  return (d) => {
    let bestDot = -Infinity
    for (const f of supports) {
      v.copy(d)
      f(v)
      const dot = v.dot(d)
      if (dot > bestDot) {
        best.copy(v)
        bestDot = dot
      }
    }
    d.copy(best)
  }
}

/**
 * Returns a support function that applys a transformation. It takes two
 * functions as arguments: transform, and inverse. transform takes a vector in
 * object space and transforms it to world space. inverse takes a direction in
 * world space and transforms it to object space.
 *
 * Note that inverse should operate on a **direction**, and should not apply a
 * translation.
 */
export function transformable (support, transform, inverse) {
  return (d) => {
    inverse(d)
    support(d)
    transform(d)
  }
}

/**
 * Returns an object that can be added to the scene, built with the given
 * support functions.
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
  const transformInverse = new Matrix4()
  const changed = new BehaviorSubject()
  const position = new Vector3(0, 0, 0)
  const velocity = new Vector3(0, 0, 0)

  const beginOverlap = new Subject()
  const stayOverlap = new Subject()
  const endOverlap = new Subject()

  const ret = {
    update () {
      transformInverse.copy(transform)
      transformInverse.invert()
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
        d.transformDirection(transformInverse)
      })
    f.body = ret
    return f
  })
  return ret
}

/**
 * Returns a scene object. The scene has the following fields:
 *  - add (bodys)
 *  - remove (body)
 */
export function scene () {
  const bodies = []
  const dynamicBodies = []

  let subscriptions = []
  let updates = null

  const gravity = new Vector3(0, -9.8, 0)
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
  const normal = new Vector3()
  const onOverlap = (a, b, amount) => {
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
      } else if (a.body.isKinematic) {
        b.body.position.add(amount)
        b.body.transform.setPosition(b.body.position)
        b.body.update()
      } else if (b.body.isKinematic) {
        a.body.position.addScaledVector(amount, -1.0)
        a.body.transform.setPosition(a.body.position)
        a.body.update()
      }

      /* Cancel velocities. */
      if (!a.body.isKinematic) {
        a.body.velocity.addScaledVector(normal, -a.body.velocity.dot(normal))
      }
      if (!b.body.isKinematic) {
        b.body.velocity.addScaledVector(normal, -b.body.velocity.dot(normal))
      }
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
      if (!body.isKinematic) {
        dynamicBodies.push(body)
      }
      bodies.push(body)
      shouldUpdateTree = true
    },
    remove (body) {
      if (!body.isKinematic) {
        dynamicBodies.splice(dynamicBodies.indexOf(body), 1)
      }
      bodies.splice(bodies.indexOf(body), 1)
      shouldUpdateTree = true
    },
    update (dt) {
      if (shouldUpdateTree) {
        updateTree()
        shouldUpdateTree = false
      }
      dynamicBodies.forEach(body => {
        body.position.addScaledVector(body.velocity, dt || 0.0)
        body.velocity.addScaledVector(gravity, dt || 0.0)
        body.transform.setPosition(body.position)
        body.update()
      })
      updated.next()
    }
  }
}
