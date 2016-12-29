
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 属性节点
 *
 * @param {string|Expression} name 属性名
 * @param {?*} value 属性值
 */
export default class Attribute extends Node {

  constructor(name, value) {
    super(nodeType.ATTRIBUTE)
    this.name = name
    this.value = value
  }

}
