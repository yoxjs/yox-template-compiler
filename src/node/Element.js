
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
    if (component) {
      this.component = component
    }
  }

  addAttr(child) {
    let attrs = this.attrs || (this.attrs = [ ])
    attrs.push(child)
  }

}