
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 指令节点
 *
 * on-click="submit"  name 是 event, modifier 是 click
 *
 * @param {string} name 指令名
 * @param {?string} modifier 指令修饰符
 */
export default class Directive extends Node {

  constructor(name, modifier) {
    super(nodeType.DIRECTIVE)
    this.name = name
    if (modifier) {
      this.modifier = modifier
    }
  }

  stringify() {
    let data = {
      name: this.name,
      modifier: this.modifier,
      value: this.value,
      children: this.children,
    }
    if (this.expr) {
      data.expr = this.stringifyObject(this.expr)
    }
    return this.stringifyObject(data)
  }

}
