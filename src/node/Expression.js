
import Node from './Node'
import * as nodeType from '../nodeType'

import * as env from 'yox-common/util/env'

/**
 * 表达式节点
 *
 * @param {string} expr
 * @param {boolean} safe
 */
export default class Expression extends Node {

  constructor(expr, safe) {
    super(nodeType.EXPRESSION, env.FALSE)
    this.expr = expr
    this.safe = safe
  }

}
