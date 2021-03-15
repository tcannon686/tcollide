/* eslint-env jest */

import {
  box,
  scene,
  body
} from './index.js'

test('scene', () => {
  const s = scene()
  const b = body({
    supports: [box({})]
  })
  const c = body({
    supports: [box({ position: [0.25, 0, 0] })]
  })
  const d = body({
    supports: [box({ position: [0.5, 0, 0] })]
  })

  let bBeginOverlapCount = 0
  let cBeginOverlapCount = 0

  b.beginOverlap.subscribe(({ other, amount }) => {
    expect(other.body).toBe(c)
    bBeginOverlapCount++
  })
  c.beginOverlap.subscribe(({ other, amount }) => {
    expect(other.body).toBe(b)
    cBeginOverlapCount++
  })
  s.add(b)
  s.add(c)
  s.add(d)

  s.update()

  expect(bBeginOverlapCount).toBeGreaterThan(0)
  expect(cBeginOverlapCount).toBeGreaterThan(0)
})
