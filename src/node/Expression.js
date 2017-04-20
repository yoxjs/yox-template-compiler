
import * as env from 'yox-common/util/env'

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
    if (safe && helper.bindableTypes[ expr.type ]) {
      this.bindable = env.TRUE
    }
  }

}
