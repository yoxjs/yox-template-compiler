
import Node from './Node'
import * as nodeType from '../nodeType'

import * as env from 'yox-common/util/env'

/**
 * 延展操作 节点
 *
 * @param {Expression} expr
 */
export default class Spread extends Node {

  constructor(expr) {
    super(nodeType.SPREAD, env.FALSE)
    this.expr = expr
  }

}
