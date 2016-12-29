
import * as env from 'yox-common/util/env'

/**
 * 节点基类
 */
export default class Node {

  constructor(type, hasChildren) {
    this.type = type
  }

  addChild(child) {
    let children = this.children || (this.children = [ ])
    children.push(child)
  }

}
