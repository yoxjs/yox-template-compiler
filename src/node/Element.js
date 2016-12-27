
import Node from './Node'
import * as nodeType from '../nodeType'

import * as is from 'yox-common/util/is'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

/**
 * 元素节点
 *
 * @param {string} name
 * @param {?string} component
 */
export default class Element extends Node {

  constructor(options) {
    super(nodeType.ELEMENT)
    object.extend(this, options)
    if (!is.array(options.attrs)) {
      this.attrs = [ ]
    }
    if (!is.array(options.directives)) {
      this.directives = [ ]
    }
  }

  addChild(child) {
    let children
    if (child.type === nodeType.ATTRIBUTE) {
      children = this.attrs
    }
    else if (child.type === nodeType.DIRECTIVE) {
      children = this.directives
    }
    else {
      children = this.children
    }
    children.push(child)
  }

  render(data) {
    return new Element({
      name: this.name,
      component: this.component,
      children: this.renderChildren(data),
      attrs: this.renderChildren(data, this.attrs),
      directives: this.renderChildren(data, this.directives),
    })
  }

}
