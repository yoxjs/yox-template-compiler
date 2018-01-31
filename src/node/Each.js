
import * as array from 'yox-common/util/array'

import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * each 节点
 *
 * @param {Expression} expr
 * @param {?string} index 遍历索引值，对于数组来说是 0,1,2,...，对于对象来说是 key
 */
export default class Each extends Node {

  constructor(expr, index) {
    super(nodeType.EACH)
    this.expr = expr
    if (index) {
      this.index = index
    }
  }

  stringify() {
    let params = [
      this.stringifyObject(this.expr),
      `function(){return ${this.stringifyArray(this.children)}}`,
    ]
    if (this.index) {
      array.push(params, this.stringifyString(this.index))
    }
    return this.stringifyCall('e', params)
  }

}
