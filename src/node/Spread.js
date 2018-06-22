
import stringifyJSON from 'yox-common/function/stringifyJSON'
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * 延展操作 节点
 *
 * @param {Expression} expr
 */
export default class Spread extends Node {

  constructor(expr) {
    super(nodeType.SPREAD)
    this[ env.RAW_EXPR ] = expr
  }

  stringify() {
    return helper.stringifyCall(
      's',
      stringifyJSON(this[ env.RAW_EXPR ])
    )
  }

}
