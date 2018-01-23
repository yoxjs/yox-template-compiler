
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
      let result = node.stringifyArray(node.children)
      if (node.next) {
        return `${expr}?${result}:(${stringify(node.next)})`
      }
      else {
        if (expr) {
          return stump
            ? `${expr}?${result}:m()`
            : `${expr}&&${result}`
        }
        else {
          return result
        }
      }
    }

    return stringify(this)
  }

}
