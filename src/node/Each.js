
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * each 节点
 *
 * @param {Expression} expr
 * @param {string} index
 */
export default class Each extends Node {

  constructor(expr, index) {
    super(nodeType.EACH)
    this.expr = expr
    this.index = index
  }

}
