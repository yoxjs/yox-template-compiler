
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * else 节点
 */
export default class Else extends Node {

  constructor() {
    super(nodeType.ELSE)
  }

  render(data) {
    return this.renderChildren(data)
  }

}
