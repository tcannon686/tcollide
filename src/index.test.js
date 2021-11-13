/* eslint-env jest */

import {
  beginOverlap,
  body,
  bodyOf,
  box,
  changed,
  collisionScene,
  endOverlap,
  overlap,
  scene,
  stayOverlap
} from './index.js'

import { toArray } from 'rxjs/operators'

test('basic scene test', () => {
  const s = scene({})
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

  beginOverlap(b).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(c)
    bBeginOverlapCount++
  })
  beginOverlap(c).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(b)
    cBeginOverlapCount++
  })
  s.add(b)
  s.add(c)
  s.add(d)

  s.update()

  expect(bBeginOverlapCount).toBeGreaterThan(0)
  expect(cBeginOverlapCount).toBeGreaterThan(0)
})

test('basic observable test', () => {
  const s = collisionScene({})
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
  let bEndOverlapCount = 0
  let cEndOverlapCount = 0

  let cChangedCount = 0

  /* Set up observables. */
  overlap(s).subscribe((props) => {
    expect(props.amount).toBeDefined()
    expect(props.support).toBeDefined()
    expect(props.other).toBeDefined()
  })
  beginOverlap(b).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(c)
    bBeginOverlapCount++
  })
  beginOverlap(c).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(b)
    cBeginOverlapCount++
  })
  endOverlap(b).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(c)
    bEndOverlapCount++
  })
  endOverlap(c).subscribe(({ other, amount }) => {
    expect(bodyOf(other)).toBe(b)
    cEndOverlapCount++
  })
  expect(stayOverlap(b)).toBeDefined()
  expect(stayOverlap(c)).toBeDefined()
  changed(c).subscribe(() => {
    cChangedCount++
  })

  s.add(b)
  s.add(c)
  s.add(d)

  s.update()

  expect(bBeginOverlapCount).toBeGreaterThan(0)
  expect(cBeginOverlapCount).toBeGreaterThan(0)

  expect(bEndOverlapCount).toBe(0)
  expect(cEndOverlapCount).toBe(0)

  expect(cChangedCount).toBe(1)
  c.transform.makeTranslation(100, 0, 0)
  c.update()
  expect(cChangedCount).toBe(2)

  s.update()

  expect(bEndOverlapCount).toBeGreaterThan(0)
  expect(cEndOverlapCount).toBeGreaterThan(0)
})

test('body accessors', () => {
  const bod = body({
    supports: [box({})]
  })

  bod.supports.forEach(support => {
    expect(bodyOf(support)).toBe(bod)
  })
})

test('getOverlap on a scene', () => {
  const s = scene({})
  const a = body({
    supports: [box({})]
  })
  const b = body({
    supports: [box({ position: [2, 0, 0] })]
  })
  const c = body({
    supports: [box({ position: [4, 0, 0] })]
  })

  s.add(a)
  s.add(b)
  s.add(c)

  const expectOverlap = (observable, body) => {
    observable.pipe(toArray()).subscribe((array) => {
      expect(array.length).toBe(1)
      const { support, other, amount } = array[0]
      expect(support).toBeDefined()
      expect(amount).toBeDefined()
      expect(amount.length()).toBeGreaterThan(0)
      expect(bodyOf(support)).toBe(null)
      expect(bodyOf(other)).toBe(body)
    })
  }

  expectOverlap(s.getOverlap(box({ position: [0, 0.25, 0] })), a)
  expectOverlap(s.getOverlap(box({ position: [2, 0.25, 0] })), b)
  expectOverlap(s.getOverlap(box({ position: [4, 0.25, 0] })), c)
  s.getOverlap(box({ position: [3, 2, 0] })).pipe(toArray()).subscribe(
    array => {
      expect(array).toBe([])
    })
})
