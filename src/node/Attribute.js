
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

}
