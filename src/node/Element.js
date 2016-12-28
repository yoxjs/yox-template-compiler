
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 元素节点
 *
 * @param {string} name
 * @param {?boolean} component 是否是组件
 */
export default class Element extends Node {

  constructor(name, component) {
    super(nodeType.ELEMENT)
    this.name = name
    this.component = component
    this.attributes = [ ]
    this.directives = [ ]
  }

  addChild(child) {
    let children
    switch (child.type) {
      case nodeType.ATTRIBUTE:
      case nodeType.SPREAD:
        children = this.attributes
        break
      case nodeType.DIRECTIVE:
        children = this.directives
        break
      default:
        children = this.children
        break
    }
    children.push(child)
  }

}
