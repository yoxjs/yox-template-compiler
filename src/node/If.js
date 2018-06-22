
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * if 节点
 *
 * @param {Expression} expr 判断条件
 */
export default class If extends Node {

  constructor(expr) {
    super(nodeType.IF)
    this[ env.RAW_EXPR ] = expr
  }

  stringify() {

    let { stump } = this

    let stringify = function (node) {
      let expr = helper.stringifyExpression(node[ env.RAW_EXPR ])
      let children = helper.stringifyArray(node[ env.RAW_CHILDREN ], 'x')
      let next = node.next
      if (next) {
        next = stringify(next)
      }
      else if (stump) {
        next = 'x(m())'
      }
      if (expr) {
        if (children) {
          return next
            ? `${expr}?${children}:${next}`
            : `${expr}&&${children}`
        }
        else if (next) {
          return `!${expr}&&${next}`
        }
      }
      else if (children) {
        return children
      }
    }

    let str = stringify(this)
    if (str) {
      return helper.stringifyFunction(str)
    }

  }

}
