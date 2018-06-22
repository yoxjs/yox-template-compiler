
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * else if 节点
 *
 * @param {Expression} expr 判断条件
 */
export default class ElseIf extends Node {

  constructor(expr, then) {
    super(nodeType.ELSE_IF)
    this[ env.RAW_EXPR ] = expr
  }

}
