
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 属性节点
 *
 * @param {string|Expression} name 属性名
 */
export default class Attribute extends Node {

  constructor(name) {
    super(nodeType.ATTRIBUTE)
    this.name = name
  }

  stringify() {
    let data = {
      name: this.name,
      value: this.value,
      children: this.children,
      binding: this.binding,
    }
    if (this.expr) {
      data.expr = this.stringifyObject(this.expr)
    }
    return this.stringifyObject(data)
  }

}
