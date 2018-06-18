
import stringifyJSON from 'yox-common/function/stringifyJSON'
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * import 节点
 *
 * @param {string} name
 */
export default class Import extends Node {

  constructor(name) {
    super(nodeType.IMPORT)
    this[ env.RAW_NAME ] = name
  }

  stringify() {
    return helper.stringifyCall(
      'i',
      stringifyJSON(this.name)
    )
  }

}
