
import * as env from 'yox-common/util/env'

import * as helper from '../helper'

/**
 * 节点基类
 */
export default class Node {

  constructor(type) {
    this[ env.RAW_TYPE ] = type
  }

  stringify() {
    return helper.stringifyObject(this)
  }

}
