
import * as env from 'yox-common/util/env'

/**
 * 节点基类
 */
export default class Node {

  constructor(type, hasChildren) {
    this.type = type
    if (hasChildren !== env.FALSE) {
      this.children = [ ]
    }
  }

  addChild(child) {
    this.children.push(child)
  }

}
