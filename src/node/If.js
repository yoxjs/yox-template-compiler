
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * if 节点
 *
 * @param {Expression} expr 判断条件
 */
export default class If extends Node {

  constructor(expr) {
    super(nodeType.IF)
    this.expr = expr
  }

  stringify() {

    let { stump } = this

    let stringify = function (node) {
      let expr = node.stringifyExpression(node.expr)
      let result = node.stringifyArray(node.children, env.TRUE)
      if (node.next) {
        return `${expr}?${result}:(${stringify(node.next)})`
      }
      else {
        if (expr) {
          return `${expr}?${result}:${stump ? 'm()' : env.RAW_NULL}`
        }
        else {
          return result
        }
      }
    }

    return stringify(this)
  }

}
