/* eslint-env jest */

import {
  gjk,
  getOverlap
} from './gjk.js'

import {
  sphere,
  box,
  point,
  hull,
  circle,
  transformable
} from './shapes.js'

import { Vector3, Matrix4 } from 'three'

test('getOverlap boxes', () => {
  {
    const box1 = box({})
    const box2 = box({ position: [0.0, 0.45, 0] })
    const out = new Vector3()
    expect(getOverlap(out, box1, box2)).toBe(true)
    expect(out.toArray()).toEqual([0, 0.55, 0])
  }

  {
    const box1 = box({})
    const box2 = box({ position: [0.0, 1.0, 0] })
    const out = new Vector3()
    expect(getOverlap(out, box1, box2)).toBe(true)
    expect(out.toArray()).toEqual([0, 0, 0])
  }

  {
    const box1 = box({})
    const box2 = box({})
    const out = new Vector3()
    expect(getOverlap(out, box1, box2)).toBe(true)
    expect(out.length()).toBeGreaterThanOrEqual(1.0)
  }
})

test('getOverlap transformable', () => {
  const transform = new Matrix4().makeTranslation(0, 0.45, 0)
  const transformInverse = new Matrix4().copy(transform).invert()
  const box1 = box({})
  const box2 = transformable(
    box({}),
    d => {
      d.applyMatrix4(transform)
    },
    d => {
      d.transformDirection(transformInverse)
    }
  )
  const out = new Vector3()
  expect(getOverlap(out, box1, box2)).toBe(true)
  expect(out.toArray()).toEqual([0, 0.55, 0])
})

test('getOverlap spheres', () => {
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        if (i === 5 && j === 5 && k === 5) {
          continue
        }
        const sphere1 = sphere({
          position: [5, 5, 5],
          radius: 5.0
        })
        const sphere2 = sphere({
          position: [i, j, k],
          radius: 2.0
        })
        const out = new Vector3()
        const shouldOverlap = (
          (i - 5) ** 2 + (j - 5) ** 2 + (k - 5) ** 2 < (5 + 2) ** 2
        )
        const expectedLength = Math.abs(
          ((i - 5) ** 2 + (j - 5) ** 2 + (k - 5) ** 2) ** 0.5 - (5 + 2)
        )
        expect(getOverlap(out, sphere1, sphere2)).toBe(shouldOverlap)
        if (shouldOverlap) {
          expect(Math.abs(out.length() - expectedLength)).toBeLessThan(0.1)
        }
      }
    }
  }
})

test('getOverlap hull', () => {
  const t = hull(point(1, 1, 0), point(-1, 1, 0), point(-1, -1, 0))
  const s = sphere({ position: [0, 0, 0], radius: 0.5 })

  const out = new Vector3()
  const expectedValue = new Vector3(0.5 / Math.sqrt(2), 0.5 / Math.sqrt(2), 0)
  expect(getOverlap(out, t, s)).toBe(true)
  expect(out.length() - expectedValue.length()).toBeLessThan(0.01)
  expect(out.dot(new Vector3(1, -1, 0))).toBeGreaterThan(0)
})

test('getOverlap worst', () => {
  const s = sphere({ position: [0, 0, 0], radius: 1.0 })
  const out = new Vector3()
  expect(getOverlap(out, s, s)).toBe(true)
  expect(out.length() - 2.0).toBeLessThan(0.1)
})

test('gjk boxes', () => {
  const box1 = box({})
  const box2 = box({ position: [0.25, 0.25, 0] })
  expect(gjk(box1, box2)).toBe(true)
})

test('gjk spheres', () => {
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        const sphere1 = sphere({
          position: [5, 5, 5],
          radius: 5.0
        })
        const sphere2 = sphere({
          position: [i, j, k],
          radius: 2.0
        })
        expect(gjk(sphere1, sphere2)).toBe(
          (i - 5) ** 2 + (j - 5) ** 2 + (k - 5) ** 2 < (5 + 2) ** 2
        )
      }
    }
  }
})

test('gjk cylinders', () => {
  const cylinder1 = hull(
    circle({}),
    circle({ position: [0, 1, 0] })
  )
  const cylinder2 = hull(
    circle({ position: [-1.95, 0.975, 0] }),
    circle({ position: [-1.95, 0.975 + 1, 0] })
  )
  const out = new Vector3()
  expect(gjk(cylinder1, cylinder2)).toBe(true)
  expect(getOverlap(out, cylinder1, cylinder2)).toBe(true)
  expect(out.lengthSq()).toBeGreaterThan(0)
})
