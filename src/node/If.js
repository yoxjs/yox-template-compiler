
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
      let children = node.stringifyArray(node.children, 'x')
      let next = node.next
      if (next) {
        next = stringify(next)
      }
      else if (stump) {
        next = 'x(m())'
      }
      if (expr) {
        if (children) {
          if (next) {
            return `${expr}?${children}:${next}`
          }
          return `${expr}&&${children}`
        }
        else {
          if (next) {
            return `!${expr}&&${next}`
          }
        }
      }
      else if (children) {
        return children
      }
    }

    let str = stringify(this)
    if (str) {
      return this.stringifyFunction(str)
    }

  }

}
