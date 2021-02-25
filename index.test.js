/* eslint-env jest */

import { gjk, sphere, box, getOverlap } from './index.js'
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
