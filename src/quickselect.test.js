/* eslint-env jest */

import { quickselect } from './quickselect'

function makeLists (length) {
  const ret = []
  if (length === 1) {
    for (let i = 0; i < length; i++) {
      ret.push([i])
    }
  } else {
    const next = makeLists(length - 1)
    for (const list of next) {
      for (let i = 0; i < length; i++) {
        ret.push([...list, i])
      }
    }
  }
  return ret
}

test('quickselect min', () => {
  for (const list of makeLists(6)) {
    const expected = Math.min(...list)
    const actual = quickselect(list, 0)
    expect(actual).toEqual(expected)
  }
})

test('quickselect max', () => {
  for (const list of makeLists(6)) {
    const expected = Math.max(...list)
    const actual = quickselect(list, list.length - 1)
    expect(actual).toEqual(expected)
  }
})

test('quickselect median', () => {
  for (const list of makeLists(6)) {
    const index = Math.floor(list.length / 2)
    const sorted = list.sort((a, b) => a - b)
    const expected = sorted[index]
    const actual = quickselect(list, index)
    expect(actual).toEqual(expected)
  }
})
