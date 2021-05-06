import { profiler } from './profile'

function partition (list, left, right, pivotIndex, compare) {
  const pivotValue = list[pivotIndex]

  /* Swap. */
  list[pivotIndex] = list[right]
  list[right] = pivotValue

  let storeIndex = left
  for (let i = left; i < right; i++) {
    if (compare(list[i], pivotValue) < 0) {
      /* Swap. */
      const tmp = list[storeIndex]
      list[storeIndex] = list[i]
      list[i] = tmp
      storeIndex++
    }
  }

  /* Swap. */
  {
    const tmp = list[storeIndex]
    list[storeIndex] = list[right]
    list[right] = tmp
  }

  return storeIndex
}

function select (list, left, right, k, compare) {
  if (left === right) {
    return list[left]
  }
  let pivotIndex = left + Math.floor(Math.random() % (right - left + 1))
  pivotIndex = partition(list, left, right, pivotIndex, compare)
  if (k === pivotIndex) {
    return list[k]
  } else if (k < pivotIndex) {
    return select(list, left, pivotIndex - 1, k, compare)
  } else {
    return select(list, pivotIndex + 1, right, k, compare)
  }
}

const defaultCompare = (a, b) => (a - b)

export function quickselect (list, k, compare = defaultCompare) {
  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      profiler().data.quickselectStopwatch.start()
    }
  }
  const ret = select(list, 0, list.length - 1, k, compare)
  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      profiler().data.quickselectStopwatch.stop()
    }
  }
  return ret
}
