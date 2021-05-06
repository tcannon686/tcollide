import { Vector3 } from 'three'
import { getOverlap } from './gjk.js'
import { quickselect } from './quickselect.js'
import { profiler } from './profile'

const axes = ['x', 'y', 'z']

function overlaps (left, right) {
  return (
    left.max.x >= right.min.x &&
    left.min.x <= right.max.x &&
    left.max.y >= right.min.y &&
    left.min.y <= right.max.y &&
    left.max.z >= right.min.z &&
    left.min.z <= right.max.z
  )
}

function LeafNode (support, root) {
  this.min = new Vector3()
  this.max = new Vector3()
  this.origin = new Vector3()
  this.support = support
  this.root = root
  this.dirs = this.startDirs.map(x => new Vector3())
  this.updateBox()
}

LeafNode.prototype.startDirs = [
  new Vector3(-1, 0, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, -1),
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1)
]

LeafNode.prototype.updateBox = function () {
  for (let i = 0; i < this.startDirs.length; i++) {
    this.support(this.dirs[i].copy(this.startDirs[i]))
  }
  this.min.set(
    this.dirs[0].x,
    this.dirs[1].y,
    this.dirs[2].z
  )
  this.max.set(
    this.dirs[3].x,
    this.dirs[4].y,
    this.dirs[5].z
  )
  this.origin.copy(this.min).add(this.max).multiplyScalar(0.5)
}

LeafNode.prototype.update = function () {
  this.updateBox()
  if (this.parent) {
    this.parent.update()
  }
  this.root.handleUpdate(this)
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
function leafNode (support, root) {
  return new LeafNode(support, root)
}

function InnerNode (nodes, parent) {
  this.parent = parent

  this.firstMin = new Vector3()
  this.firstMax = new Vector3()
  this.firstPos = new Vector3()

  this.min = new Vector3()
  this.max = new Vector3()
  this.origin = new Vector3()

  this.maxMove = 0.5
  this.nodes = nodes

  this.generate()
}

InnerNode.prototype.minOnAxis = function (a) {
  return (
    Math.min(
      this.left ? this.left.min[a] : Infinity,
      this.right ? this.right.min[a] : Infinity,
      this.node.min[a]
    )
  )
}

InnerNode.prototype.maxOnAxis = function (a) {
  return (
    Math.max(
      this.left ? this.left.max[a] : -Infinity,
      this.right ? this.right.max[a] : -Infinity,
      this.node.max[a]
    )
  )
}

InnerNode.prototype.updateBox = function () {
  this.min.set(
    this.minOnAxis('x'),
    this.minOnAxis('y'),
    this.minOnAxis('z')
  )
  this.max.set(
    this.maxOnAxis('x'),
    this.maxOnAxis('y'),
    this.maxOnAxis('z')
  )
  this.origin.copy(this.min).add(this.max).multiplyScalar(0.5)
}

InnerNode.prototype.updateStartSize = function () {
  this.firstMin.copy(this.min)
  this.firstMax.copy(this.max)
  this.firstPos.copy(this.node.origin)
  this.maxMove = this.firstMax[this.axisName] - this.firstMin[this.axisName]
}

InnerNode.prototype.generate = function () {
  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      if (!this.parent) {
        profiler().data.treeGenerateStopwatch.start()
      }
    }
  }

  if (this.nodes.length === 1) {
    this.node = this.nodes[0]
    this.node.parent = this
    this.left = null
    this.right = null
  } else {
    /* Split along axis with highest variance. */
    const means = [0, 0, 0]
    for (const k in this.nodes) {
      means[0] += this.nodes[k].origin.x
      means[1] += this.nodes[k].origin.y
      means[2] += this.nodes[k].origin.z
    }
    means[0] /= this.nodes.length
    means[1] /= this.nodes.length
    means[2] /= this.nodes.length

    const variances = [0, 0, 0]
    for (const k in this.nodes) {
      variances[0] += (this.nodes[k].origin.x - means[0]) ** 2
      variances[1] += (this.nodes[k].origin.y - means[1]) ** 2
      variances[2] += (this.nodes[k].origin.z - means[2]) ** 2
    }

    this.axisIndex = (
      (variances[0] > variances[1])
      ? (variances[0] > variances[2] ? 0 : 2)
      : (variances[1] > variances[2] ? 1 : 2)
    )
    this.axisName = axes[this.axisIndex]

    /* Find the median. */
    const k = Math.floor(this.nodes.length / 2)
    this.node = quickselect(
      this.nodes,
      k,
      (a, b) => b.origin[this.axisName] - a.origin[this.axisName]
    )
    this.node.parent = this
    const leftNodes = []
    const rightNodes = []

    /* Partition based on the median. */
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i] !== this.node) {
        if (
          this.nodes[i].origin[this.axisName] < this.node.origin[this.axisName]
        ) {
          leftNodes.push(this.nodes[i])
        } else {
          rightNodes.push(this.nodes[i])
        }
      }
    }

    this.left = innerNode(leftNodes, this)
    this.right = innerNode(rightNodes, this)
  }
  this.updateBox()
  this.updateStartSize()

  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      if (!this.parent) {
        profiler().data.treeGenerateStopwatch.stop()
        profiler().data.treeHeight.add(this.height())
      }
    }
  }
}

InnerNode.prototype.update = function () {
  this.updateBox()
  if (
    (this.min.x - this.firstMin.x) < -this.maxMove ||
    (this.min.y - this.firstMin.y) < -this.maxMove ||
    (this.min.z - this.firstMin.z) < -this.maxMove ||
    (this.max.x - this.firstMax.x) > this.maxMove ||
    (this.max.y - this.firstMax.y) > this.maxMove ||
    (this.max.z - this.firstMax.z) > this.maxMove ||
    Math.abs(this.node.origin.x - this.firstPos.x) > this.maxMove ||
    Math.abs(this.node.origin.y - this.firstPos.y) > this.maxMove ||
    Math.abs(this.node.origin.z - this.firstPos.z) > this.maxMove
  ) {
    if (!this.parent || !this.parent.update()) {
      this.generate()
    }
    return true
  } else {
    if (this.parent) {
      return this.parent.update()
    }
  }
}

InnerNode.prototype.height = function () {
  return Math.max(
    this.left ? this.left.height() : 0,
    this.right ? this.right.height() : 0) + 1
}

function innerNode (nodes, parent) {
  if (nodes.length === 0) {
    return null
  }
  return new InnerNode(nodes, parent)
}

function KdTree (callbacks, tolerance) {
  this.callbacks = callbacks
  this.tolerance = tolerance
  this.currentlyOverlapping = new Map()
  this.visited = new Set()
  this.out = new Vector3()
  this.needsRebuild = true
  this.nodes = []
}

KdTree.prototype.add = function (support) {
  const node = leafNode(support, this)
  this.needsRebuild = true
  this.nodes.push(node)
  /* Return the update function for the node. */
  return node.update.bind(node)
}

KdTree.prototype.remove = function (support) {
  this.nodes.splice(this.nodes.findIndex(node => node.support === support), 1)
  this.needsRebuild = true
}

KdTree.prototype.dfs = function (node, tree, out) {
  if (tree) {
    if (overlaps(node, tree)) {
      if (node !== tree.node && overlaps(node, tree.node)) {
        const support = node.support
        const other = tree.node.support
        if (!this.currentlyOverlapping.has(support)) {
          this.currentlyOverlapping.set(support, new Set())
        }

        const initialAxis = new Vector3(1, 0, 0)
        if (
          getOverlap(
            out,
            support,
            other,
            initialAxis,
            this.tolerance)
        ) {
          if (!this.currentlyOverlapping.has(other)) {
            this.currentlyOverlapping.set(other, new Set())
          }
          const supportSet = this.currentlyOverlapping.get(support)
          const otherSet = this.currentlyOverlapping.get(other)

          if (this.callbacks.onOverlap) {
            this.callbacks.onOverlap(support, other, out)
          }

          if (!supportSet.has(other)) {
            supportSet.add(other)
            otherSet.add(support)
            if (this.callbacks.onBeginOverlap) {
              this.callbacks.onBeginOverlap(support, other, out)
            }
          } else {
            if (this.callbacks.onStayOverlap) {
              this.callbacks.onStayOverlap(support, other, out)
            }
          }
          this.visited.add(other)
        }
      }
      this.dfs(node, tree.left, out)
      this.dfs(node, tree.right, out)
    }
  }
}

KdTree.prototype.handleUpdate = function (node) {
  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      profiler().data.updateStopwatch.start()
    }
  }

  /* Rebuild the tree if necessary. */
  if (this.needsRebuild) {
    this.root = innerNode([...this.nodes], null)
    this.needsRebuild = false
  }

  this.visited.clear()
  this.dfs(node, this.root, this.out)
  const set = this.currentlyOverlapping.get(node.support)
  if (set) {
    for (const x of set) {
      if (!this.visited.has(x)) {
        set.delete(x)
        this.currentlyOverlapping.get(x).delete(node.support)
        this.callbacks.onEndOverlap(node.support, x)
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    if (profiler()) {
      profiler().data.updateStopwatch.stop()
    }
  }
}

KdTree.prototype.dispose = function () {
  this.currentlyOverlapping.forEach((set, support) => {
    if (set) {
      set.forEach(other => {
        this.callbacks.onEndOverlap(support, other)
      })
    }
  })
}

/*
 * Creates a kdTree given a set of supports and a set of callbacks. The
 * callbacks object may contain three methods: onBeginOverlap(support, other,
 * amount), onEndOverlap(support, other, amount), onStayOverlap(support, other,
 * overlap), and onOverlap(support, other, amount). If any overlap occurs,
 * onOverlap is called, followed by onBeginOverlap or onEndOverlap.
 */
export function kdTree (callbacks, tolerance) {
  const tree = new KdTree(callbacks, tolerance)
  return tree
}
