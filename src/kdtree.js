import { Vector3 } from 'three'
import { getOverlap } from './gjk.js'
import { quickselect } from './quickselect.js'

const axes = ['x', 'y', 'z']

function overlaps (left, right) {
  for (const axis of axes) {
    if (
      left.max[axis] < right.min[axis] ||
      left.min[axis] > right.max[axis]
    ) {
      return false
    }
  }
  return true
}

/*
 * Returns a bounding box for the given support function. The bounding box is an
 * object that looks like this:
 *
 * {
 *   support, // The support function
 *   max: Vector3,
 *   min: Vector3,
 *   update(), // Should be called to regenerate the box
 *   onUpdate(), // Called when update is called
 * }
 */
function leafNode (support, onUpdate) {
  const min = new Vector3()
  const max = new Vector3()
  const origin = new Vector3()

  const startDirs = [
    new Vector3(-1, 0, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, -1),
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1)
  ]

  const dirs = startDirs.map(x => new Vector3())

  const ret = {
    min,
    max,
    origin,
    support
  }

  const update = () => {
    dirs.forEach((x, i) => support(x.copy(startDirs[i])))

    min.set(
      dirs[0].x,
      dirs[1].y,
      dirs[2].z
    )
    max.set(
      dirs[3].x,
      dirs[4].y,
      dirs[5].z
    )
    origin.copy(min).add(max).multiplyScalar(0.5)

    ret.parent.update()
    onUpdate(ret)
  }

  ret.update = update
  return ret
}

function innerNode (nodes, axisIndex = 0) {
  if (nodes.length === 0) {
    return null
  }

  const axisName = axes[axisIndex]

  const firstMin = new Vector3()
  const firstMax = new Vector3()
  const firstPos = new Vector3()

  const min = new Vector3()
  const max = new Vector3()
  const origin = new Vector3()

  let maxMove = 0.5

  const minOnAxis = (a) => (
    Math.min(
      ret.left ? ret.left.min[a] : Infinity,
      ret.right ? ret.right.min[a] : Infinity,
      ret.node.min[a]
    )
  )

  const maxOnAxis = (a) => (
    Math.max(
      ret.left ? ret.left.max[a] : -Infinity,
      ret.right ? ret.right.max[a] : -Infinity,
      ret.node.max[a]
    )
  )

  const updateBox = () => {
    min.set(
      minOnAxis('x'),
      minOnAxis('y'),
      minOnAxis('z')
    )
    max.set(
      maxOnAxis('x'),
      maxOnAxis('y'),
      maxOnAxis('z')
    )
    origin.copy(min).add(max).multiplyScalar(0.5)
  }

  const ret = {
    min,
    max,
    origin
  }

  const updateStartSize = () => {
    firstMin.copy(min)
    firstMax.copy(max)
    firstPos.copy(ret.node.origin)
    maxMove = firstMax[axisName] - firstMin[axisName]
  }

  const generate = () => {
    /* Find the median. */
    const k = Math.floor(nodes.length / 2)
    const node = quickselect(nodes, k, (a, b) => b.origin[axisName] - a.origin[axisName])
    const leftNodes = []
    const rightNodes = []

    /* Partition based on the median. */
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] !== node) {
        if (nodes[i].origin[axisName] < node.origin[axisName]) {
          leftNodes.push(nodes[i])
        } else {
          rightNodes.push(nodes[i])
        }
      }
    }

    node.parent = ret
    ret.node = node
    ret.left = innerNode(leftNodes, (axisIndex + 1) % axes.length)
    if (ret.left) {
      ret.left.parent = ret
    }
    ret.right = innerNode(rightNodes, (axisIndex + 1) % axes.length)
    if (ret.right) {
      ret.right.parent = ret
    }
    updateBox()
    updateStartSize()
  }

  const update = () => {
    updateBox()
    if (
      (min.x - firstMin.x) < -maxMove ||
      (min.y - firstMin.y) < -maxMove ||
      (min.z - firstMin.z) < -maxMove ||
      (max.x - firstMax.x) > maxMove ||
      (max.y - firstMax.y) > maxMove ||
      (max.z - firstMax.z) > maxMove ||
      Math.abs(ret.node.origin.x - firstPos.x) > maxMove ||
      Math.abs(ret.node.origin.y - firstPos.y) > maxMove ||
      Math.abs(ret.node.origin.z - firstPos.z) > maxMove
    ) {
      if (!ret.parent || !ret.parent.update()) {
        generate()
      }
      return true
    } else {
      if (ret.parent) {
        return ret.parent.update()
      }
    }
  }

  generate()

  ret.update = update

  return ret
}

/*
 * Creates a kdTree given a set of supports and a set of callbacks. Returns an
 * array of functions that can be used to update each object. The callbacks
 * object may contain three methods: onBeginOverlap(support, other, amount),
 * onEndOverlap(support, other, amount), onStayOverlap(support, other, overlap),
 * and onOverlap(support, other, amount). If any overlap occurs, onOverlap is
 * called, followed by onBeginOverlap or onEndOverlap.
 */
export function kdTree (supports, callbacks, tolerance) {
  const currentlyOverlapping = new Map()
  const visited = new Set()
  const out = new Vector3()
  const initialAxis = new Vector3(1, 0, 0)
  const dfs = (node, tree) => {
    if (tree) {
      if (overlaps(node, tree)) {
        if (node !== tree.node && overlaps(node, tree.node)) {
          const support = node.support
          const other = tree.node.support
          if (!currentlyOverlapping.has(support)) {
            currentlyOverlapping.set(support, new Set())
          }
          if (getOverlap(out, support, other, initialAxis, tolerance)) {
            if (!currentlyOverlapping.has(other)) {
              currentlyOverlapping.set(other, new Set())
            }
            const supportSet = currentlyOverlapping.get(support)
            const otherSet = currentlyOverlapping.get(other)

            if (callbacks.onOverlap) {
              callbacks.onOverlap(support, other, out)
            }

            if (!supportSet.has(other)) {
              supportSet.add(other)
              otherSet.add(support)
              if (callbacks.onBeginOverlap) {
                callbacks.onBeginOverlap(support, other, out)
              }
            } else {
              if (callbacks.onStayOverlap) {
                callbacks.onStayOverlap(support, other, out)
              }
            }
            visited.add(other)
          }
        }
        dfs(node, tree.left)
        dfs(node, tree.right)
      }
    }
  }

  const handleUpdate = (node) => {
    visited.clear()
    dfs(node, root)
    const set = currentlyOverlapping.get(node.support)
    if (set) {
      set.forEach(x => {
        if (!visited.has(x)) {
          set.delete(x)
          currentlyOverlapping.get(x).delete(node.support)
          callbacks.onEndOverlap(node.support, x)
        }
      })
    }
  }

  const nodes = supports.map(x => leafNode(
    x,
    handleUpdate
  ))

  const root = innerNode(nodes)
  return nodes.map(x => x.update)
}
