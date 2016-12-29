
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 延展操作 节点
 *
 * @param {Expression} expr
 */
export default class Spread extends Node {

  constructor(expr) {
    super(nodeType.SPREAD)
    this.expr = expr
  }

}
