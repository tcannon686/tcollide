/* eslint-env jest */

import {
  sum,
  point
} from './shapes'

import {
  Vector3
} from 'three'

test('sum', () => {
  const s = sum(point(1, 2, 3), point (2, 3, 4))
  const v = new Vector3(1, 1, 1).normalize()
  s(v)
  expect(v.x).toEqual(3)
  expect(v.y).toEqual(5)
  expect(v.z).toEqual(7)
})
