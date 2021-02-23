import { Vector3 } from 'three'

function makeTriangle (ia, ib, ic, vertices) {
  const ac = vertices[ic].clone().sub(vertices[ia])
  const bc = vertices[ic].clone().sub(vertices[ib])
  const normal = ac.cross(bc).normalize()
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
  d.set(0, 0, 0).sub(s[0])
  return d.dot(d) === 0
}

nearestSimplex[2] = function (s, d) {
  const ab = s[1].clone().sub(s[0])
  if (ab.dot(s[1]) <= 0) {
    s[0] = s.pop()
    d.copy(s[0]).negate()
    return false
  } else {
    d.copy(s[0]).cross(ab).cross(ab)
    return false
  }
}

nearestSimplex[3] = function (s, d) {
  const ac = s[2].copy().sub(s[0])
  const bc = s[2].copy().sub(s[1])
  const abc = ac.clone().cross(bc)

  const acn = ac.clone().cross(abc)
  const bcn = abc.clone().cross(bc)

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
        s[0] = s.pop()
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
  const ad = s[3].clone().sub(s[0])
  const bd = s[3].clone().sub(s[1])
  const cd = s[3].clone().sub(s[2])

  const abd = bd.clone().cross(ad)
  const bcd = cd.clone().cross(bd)
  const cad = ad.clone().cross(cd)

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

export function gjk (a, b, d, s) {
  while (true) {
    const p = a.support(d).sub(b.support(d))

    if (p.dot(d) <= 0) {
      return false
    }

    /* Add to the simplex. */
    s.push_back(p)

    if (nearestSimplex[s.length](s, d)) {
      return true
    }
  }
}

export function getOverlap (
  out,
  a,
  b,
  initialAxis
) {
  const s = []
  const d = a.support(initialAxis).sub(b.support(initialAxis))
  s.push(d)
  d.negate()

  if (gjk(a, b, d, s)) {
    if (s.length < 4) {
      out.set(0, 0, 0)
    } else {
      /* Create a triangular mesh for the simplex. */
      const triangles = []
      const vertices = s

      triangles.push(makeTriangle(0, 2, 1, vertices))
      triangles.push(makeTriangle(0, 1, 3, vertices))
      triangles.push(makeTriangle(1, 2, 3, vertices))
      triangles.push(makeTriangle(2, 0, 3, vertices))

      // epa(out, a, b, triangles, vertices, other)
    }
    return true
  }
}
