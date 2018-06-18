
import stringifyJSON from 'yox-common/function/stringifyJSON'
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * Partial 节点
 *
 * @param {string} name
 */
export default class Partial extends Node {

  constructor(name) {
    super(nodeType.PARTIAL)
    this[ env.RAW_NAME ] = name
  }

  stringify() {
    return helper.stringifyCall(
      'p',
      [
        stringifyJSON(this[ env.RAW_NAME ]),
        helper.stringifyFunction(
          helper.stringifyArray(this[ env.RAW_CHILDREN ], 'x')
        )
      ]
    )
  }

}
