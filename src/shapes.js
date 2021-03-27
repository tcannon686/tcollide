import { Vector3 } from 'three'

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
    d.multiplyScalar(r).add(p)
  )
}

/**
 * Returns a circle support function given the position, radius, and axis, where
 * axis is an array representing the normal of the circle.
 */
export function circle ({
  position,
  radius,
  axis
}) {
  const p = position ? new Vector3(...position) : new Vector3(0, 0, 0)
  const a = axis ? new Vector3(...axis) : new Vector3(0, 1, 0)
  const r = radius || 1.0
  return (d) => (
    d.addScaledVector(a, -d.dot(a)).normalize().multiplyScalar(r).add(p)
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
export function hull (...supports) {
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
