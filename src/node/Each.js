
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * each 节点
 *
 * @param {Expression} expr
 * @param {?string} index 遍历索引值，对于数组来说是 0,1,2,...，对于对象来说是 key
 * @param {?string} trackBy 提升性能使用的 trackBy
 */
export default class Each extends Node {

  constructor(expr, index, trackBy) {
    super(nodeType.EACH)
    this.expr = expr
    if (index) {
      this.index = index
    }
    if (trackBy) {
      this.trackBy = trackBy
    }
  }

}
