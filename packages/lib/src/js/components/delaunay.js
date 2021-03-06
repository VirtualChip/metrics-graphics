import { Delaunay as DelaunayObject } from 'd3-delaunay'
import { mouse } from 'd3-selection'

/**
 * Instantiate a new delaunay computation instance.
 *
 * @param {Object} args argument object.
 * @param {Array} args.points raw data basis for delaunay computations. Can be nested.
 * @param {Function} args.xAccessor function to access the x value for a given data point.
 * @param {Function} args.yAccessor function to access the y value for a given data point.
 * @param {Scale} args.xScale scale used to scale elements in x direction.
 * @param {Scale} args.yScale scale used to scale elements in y direction.
 * @param {Function} [args.onPoint] function called with the array of nearest points on mouse movement. If aggregate is false, the array will contain at most one element.
 * @param {Function} [args.onLeave] function called when the delaunay area is left.
 * @param {Function} [args.onClick] function called with the array of nearest points on mouse click in the delaunay area. If aggregate is false, the array will contain at most one element.
 * @param {Boolean} [args.nested=false] whether or not the points array contains sub-arrays.
 * @param {Boolean} [args.aggregate=false] if multiple points have the same x value and should be shown together, aggregate can be set to true.
 * @param {Function} [args.defined] optional function specifying whether or not to show a given datapoint.
 */
export default class Delaunay {
  points = []
  aggregatedPoints = null
  delaunay = null
  xScale = null
  yScale = null
  xAccessor = null
  yAccessor = null
  aggregate = false

  constructor ({
    points = [],
    xAccessor,
    yAccessor,
    xScale,
    yScale,
    onPoint,
    onLeave,
    onClick,
    nested,
    aggregate,
    defined = null
  }) {
    this.xScale = xScale
    this.yScale = yScale
    this.onPoint = onPoint ?? this.onPoint
    this.onLeave = onLeave ?? this.onLeave
    this.onClick = onClick ?? this.onClick
    this.xAccessor = xAccessor
    this.yAccessor = yAccessor
    this.aggregate = aggregate ?? this.aggregate

    // normalize passed points
    const isNested = nested ?? (Array.isArray(points[0]) && points.length > 1)
    this.normalizePoints({ points, isNested, aggregate, defined })

    // set up delaunay
    this.mountDelaunay(isNested, aggregate)
  }

  /**
   * Create a new delaunay triangulation.
   *
   * @param {Boolean} isNested whether or not the data is nested
   * @param {Boolean} aggregate whether or not to aggregate points based on their x value
   * @returns {void}
   */
  mountDelaunay (isNested, aggregate) {
    this.delaunay = DelaunayObject.from(
      this.points.map(point => ([this.xAccessor(point), isNested && !aggregate ? this.yAccessor(point) : 0]))
    )
  }

  /**
   * Normalize the passed data points.
   *
   * @param {Object} args argument object
   * @param {Array} args.points raw data array
   * @param {Boolean} args.isNested whether or not the points are nested
   * @param {Boolean} args.aggregate whether or not to aggregate points based on their x value
   * @param {Function} [args.defined] optional function specifying whether or not to show a given datapoint.
   * @returns {void}
   */
  normalizePoints ({ points, isNested, aggregate, defined = null }) {
    this.points = isNested
      ? points.map((pointArray, arrayIndex) => pointArray
        .filter(p => !defined || defined(p))
        .map((point, index) => ({
          ...point,
          index,
          arrayIndex
        }))).flat(Infinity)
      : points.flat(Infinity)
        .filter(p => !defined || defined(p))
        .map((p, index) => ({ ...p, index }))

    // if points should be aggregated, hash-map them based on their x accessor value
    if (!aggregate) return
    this.aggregatedPoints = this.points.reduce((acc, val) => {
      const key = JSON.stringify(this.xAccessor(val))
      if (!acc.has(key)) {
        acc.set(key, [val])
      } else {
        acc.set(key, [val, ...acc.get(key)])
      }
      return acc
    }, new Map())
  }

  /**
   * Handle raw mouse movement inside the delaunay rect.
   * Finds the nearest data point(s) and calls onPoint.
   *
   * @param {Number} rawX raw x coordinate of the cursor.
   * @param {Number} rawY raw y coordinate of the cursor.
   * @returns {void}
   */
  gotPoint (rawX, rawY) {
    const x = this.xScale.scaleObject.invert(rawX)
    const y = this.yScale.scaleObject.invert(rawY)

    // find nearest point
    const index = this.delaunay.find(x, y)

    // if points should be aggregated, get all points with the same x value
    if (this.aggregate) {
      this.onPoint(this.aggregatedPoints.get(JSON.stringify(this.xAccessor(this.points[index]))))
    } else {
      this.onPoint([this.points[index]])
    }
  }

  /**
   * Handle raw mouse clicks inside the delaunay rect.
   * Finds the nearest data point(s) and calls onClick.
   *
   * @param {Number} rawX raw x coordinate of the cursor.
   * @param {Number} rawY raw y coordinate of the cursor.
   * @returns {void}
   */
  clickedPoint (rawX, rawY) {
    const x = this.xScale.scaleObject.invert(rawX)
    const y = this.yScale.scaleObject.invert(rawY)

    // find nearest point
    const index = this.delaunay.find(x, y)
    if (this.onClick) this.onClick({ ...this.points[index], index })
  }

  /**
   * Mount the delaunator to a given d3 node.
   *
   * @param {Object} svg d3 selection to mount the delaunay elements to.
   * @returns {void}
   */
  mountTo (svg) {
    svg.on('mousemove', () => {
      const rawCoords = mouse(svg.node())
      this.gotPoint(rawCoords[0], rawCoords[1])
    })
    svg.on('mouseleave', () => {
      this.onLeave()
    })
    svg.on('click', () => {
      const rawCoords = mouse(svg.node())
      this.clickedPoint(rawCoords[0], rawCoords[1])
    })
  }
}
