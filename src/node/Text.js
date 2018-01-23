
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 文本节点
 *
 * @param {*} content
 */
export default class Text extends Node {

  constructor(text) {
    super(nodeType.TEXT)
    this.text = text
  }

  stringify() {
    return `'${this.text}'`
  }

}
