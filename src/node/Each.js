
import stringifyJSON from 'yox-common/function/stringifyJSON'

import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * each 节点
 *
 * @param {Expression} expr
 * @param {?string} index 遍历索引值，对于数组来说是 0,1,2,...，对于对象来说是 key
 */
export default class Each extends Node {

  constructor(expr, index) {
    super(nodeType.EACH)
    this[ env.RAW_EXPR ] = expr
    if (index) {
      this.index = index
    }
  }

  stringify() {
    let generate = helper.stringifyArray(this[ env.RAW_CHILDREN ], 'x')
    if (generate) {
      let params = [
        stringifyJSON(this[ env.RAW_EXPR ]),
        helper.stringifyFunction(generate)
      ]
      if (this.index) {
        array.push(params, stringifyJSON(this.index))
      }
      return helper.stringifyFunction(
        helper.stringifyCall('e', params)
      )
    }
  }

}
