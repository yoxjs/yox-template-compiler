
import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * 表达式节点
 *
 * @param {string} expr
 * @param {boolean} safe
 */
export default class Expression extends Node {

  constructor(expr, safe) {
    super(nodeType.EXPRESSION)
    this.expr = expr
    this.safe = safe
  }

  stringify() {
    return helper.stringifyExpression(this.expr)
  }

}
