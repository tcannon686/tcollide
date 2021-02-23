/* eslint-env jest */

import { gjk, sphere } from './index.js'

test('spheres', () => {
  for (let i = 0; i < 10; i ++) {
    for (let j = 0; j < 10; j ++) {
      for (let k = 0; k < 10; k ++) {
        const sphere1 = sphere({
          position: [5, 5, 5],
          radius: 5.0
        })
        const sphere2 = sphere({
          position: [i, j, k],
          radius: 2.0
        })
        const result = gjk(sphere1, sphere2)
        expect(result).toBe(
          (i - 5) ** 2 + (j - 5) ** 2 + (k - 5) ** 2 < (5 + 2) ** 2
        )
      }
    }
  }
})
