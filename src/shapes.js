import { Vector3 } from 'three'

/* Error checking. */
function validateVector (msg, v) {
  if (!Array.isArray(v)) {
    throw new Error(msg + ': expected Number[] but got ' + v)
  }
  if (v.some(x => typeof x !== 'number')) {
    throw new Error(msg + ': expected Number[] but got ' + v)
  }
}

function validatePositiveVector (msg, v) {
  validateVector(msg, v)
  if (v.some(x => x <= 0)) {
    throw new Error(msg + ': expected positive Number[] but got ' + v)
  }
}

function validateNumber (msg, v) {
  if (typeof v !== 'number') {
    throw new Error(msg + ': expected Number but got ' + v)
  }
}

function validatePositive (msg, v) {
  if (v <= 0) {
    throw new Error(msg + ': expected positive Number but got ' + v)
  }
}

function validateOptional (msg, v, f) {
  if (v !== undefined) {
    f(msg, v)
  }
}

function validateFunction (msg, v) {
  if (typeof v !== 'function') {
    throw new Error(msg + ': expected Function but got ' + v)
  }
}

function validateSupport (msg, v) {
  if (typeof v !== 'function') {
    throw new Error(msg + ': expected support Function but got ' + v)
  }
}

/**
 * A function that returns the point with the highest dot product with the given
 * direction on a shape.
 *
 * @typedef {Function} Support
 * @param {Vector3} d - The normalized input direction. This should be modified
 *                      in place.
 */

/**
 * Returns a sphere support function given the position and radius.
 *
 * @param {Number[]} props.position - The position of the sphere
 * @param {Number} props.radius - The radius (default 1.0)
 * @returns {Support}
 */
export function sphere ({
  position,
  radius
}) {
  validateOptional('sphere', position, validateVector)
  validateOptional('sphere', radius, validatePositive)

  const p = position ? new Vector3(...position) : new Vector3(0, 0, 0)
  const r = radius || 1.0

  return (d) => (
    d.multiplyScalar(r).add(p)
  )
}

/**
 * Returns a circle support function given the position, radius, and axis, where
 * axis is an array representing the normal of the circle.
 *
 * @param {Number[]} props.position - The position of the circle
 * @param {Number} props.radius - The radius (default 1.0)
 * @param {Number[]} props.axis - The axis around which the circle is placed
 *                                (default up).
 * @returns {Support}
 */
export function circle ({
  position,
  radius,
  axis
}) {
  validateOptional('circle', position, validateVector)
  validateOptional('circle', axis, validateVector)
  validateOptional('circle', radius, validatePositive)

  const p = position ? new Vector3(...position) : new Vector3(0, 0, 0)
  const a = axis ? new Vector3(...axis) : new Vector3(0, 1, 0)
  const r = radius || 1.0
  return (d) => (
    d.addScaledVector(a, -d.dot(a)).normalize().multiplyScalar(r).add(p)
  )
}

/**
 * Returns a box support function given the position and size. The box is
 * centered around the given position, and the length of the edges is specified
 * by the size.
 *
 * @param {Number[]} props.position - The position of the box
 * @param {Number[]} props.size - The size of the box along each axis
 * @returns {Support}
 */
export function box ({
  position,
  size
}) {
  validateOptional('box', position, validateVector)
  validateOptional('box', size, validatePositiveVector)

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
 *
 * @param {Number} x - The X position
 * @param {Number} y - The Y position
 * @param {Number} z - The Z position
 * @returns {Support}
 */
export function point (x, y, z) {
  validateNumber('point', x)
  validateNumber('point', y)
  validateNumber('point', z)

  return (d) => {
    d.set(x, y, z)
  }
}

/**
 * Returns a support function that is a combination of the given support
 * functions. Given a vector d, runs each support function with d as an
 * argument, then returns the result with the highest dot product with d.
 *
 * @param {...Support} supports - The list of support functions.
 * @returns {Support}
 */
export function hull (...supports) {
  const v = new Vector3()
  const best = new Vector3()

  for (const f of supports) {
    validateSupport('hull', f)
  }

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
 * Returns a support function that is the Minkowski sum of the given functions.
 *
 * @param {...Support} supports - The list of support functions.
 * @returns {Support}
 */
export function sum (...supports) {
  const v = new Vector3()
  const t = new Vector3()

  for (const f of supports) {
    validateSupport('sum', f)
  }

  return (d) => {
    t.set(0, 0, 0)
    for (const f of supports) {
      v.copy(d)
      f(v)
      t.add(v)
    }
    d.copy(t)
  }
}

/**
 * Returns a support function that uses a when the dot product with d is greater
 * than or equal to zero, and b when the dot product is less than zero. This can
 * be used to create shapes such as a hemisphere.
 *
 * @param {Support} a - The "top" support
 * @param {Support} b - The "bottom" support
 * @param {Number[]} d - The direction (default up)
 */
export function split (a, b, d = [0, 1, 0]) {
  validateSupport('split', a)
  validateSupport('split', b)
  validateVector('split', d)

  const v = new Vector3(...d)
  return (d) => {
    if (v.dot(d) >= 0) {
      a(d)
    } else {
      b(d)
    }
  }
}

/**
 * Returns a support function that applys a transformation. It takes two
 * functions as arguments: transform, and inverse. transform takes a vector in
 * object space and transforms it to world space. inverse takes a direction in
 * world space and transforms it to object space.
 *
 * Note that inverse should operate on a direction, and should not apply a
 * translation.
 *
 * @param {Support} support - The support function
 * @param {function} transform - A function that transforms a given vector into
 *                               world space. This should be done in place.
 * @param {function} inverse - A function that transforms a given direction into
 *                             object space. This should be done in place.
 * @returns {Support}
 */
export function transformable (support, transform, inverse) {
  validateSupport('transformable', support)
  validateFunction('transformable', transform)
  validateFunction('transformable', inverse)

  return (d) => {
    inverse(d)
    support(d)
    transform(d)
  }
}
