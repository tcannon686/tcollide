import { Vector3 } from 'three'
import assert from 'assert'

import { randomizeDirection } from './utils'

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
