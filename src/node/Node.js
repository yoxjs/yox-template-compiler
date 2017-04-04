
import * as array from 'yox-common/util/array'

/**
 * 节点基类
 */
export default class Node {

  constructor(type) {
    this.type = type
  }

  addChild(child) {
    array.push(
      this.children || (this.children = [ ]),
      child
    )
  }

}
