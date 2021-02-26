/* eslint-env jest */

import {
  gjk,
  sphere,
  box,
  point,
  hull,
  getOverlap
} from './index.js'
import { Vector3 } from 'three'

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

test('gjk boxes', () => {
  const box1 = box({})
  const box2 = box({ position: [0.25, 0.25, 0] })
  expect(gjk(box1, box2)).toBe(true)
})

test('getOverlap boxes', () => {
  const box1 = box({})
  const box2 = box({ position: [0.0, 0.45, 0] })
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
  const t = hull([point(1, 1, 0), point(-1, 1, 0), point(-1, -1, 0)])
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
