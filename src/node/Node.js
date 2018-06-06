
import * as helper from '../helper'

/**
 * 节点基类
 */
export default class Node {

  constructor(type) {
    this.type = type
  }

  stringify() {
    return helper.stringifyObject(this)
  }

}
