/* eslint-env browser */

function rollingMean () {
  let count = 0
  let mean = 0

  function add (value) {
    mean = mean * count / (count + 1)
    count++
    mean += value / count
  }

  return {
    add,
    mean: () => mean
  }
}

function stopwatch () {
  let time
  return {
    start () {
      time = performance.now()
    },
    stop () {
      const elapsed = performance.now() - time
      return elapsed
    }
  }
}

function meanStopwatch () {
  const average = rollingMean()
  const watch = stopwatch()
  return {
    start () {
      watch.start()
    },
    stop () {
      average.add(watch.stop())
      return average.mean()
    },
    mean () {
      return average.mean()
    }
  }
}

function makeProfiler () {
  const data = {
    gjkStopwatch: meanStopwatch(),
    epaStopwatch: meanStopwatch(),
    getOverlapStopwatch: meanStopwatch(),
    supportStopwatch: meanStopwatch(),
    updateStopwatch: meanStopwatch(),
    treeGenerateStopwatch: meanStopwatch(),
    quickselectStopwatch: meanStopwatch(),
    gjkIterations: rollingMean(),
    epaIterations: rollingMean(),
    treeHeight: rollingMean(),
    nearestSimplexStopwatch: meanStopwatch()
  }
  return {
    data,
    gist () {
      return (
        Object.entries(data)
          .map(([name, value]) => 'average ' + name + ': ' + value.mean())
          .join('\n')
      )
    }
  }
}

let profilerSingleton = null
/**
 * Returns the profiler currently in use, or null if none have been created.
 *
 * @returns {Profiler}
 */
export function profiler () {
  return profilerSingleton
}

/**
 * @property {Function} gist - Return a human readable string about the profile
 * @typedef Profiler
 */

/**
 * Create a profiler, to be accessed by profiler()
 */
export function createProfiler () {
  profilerSingleton = makeProfiler()
}
