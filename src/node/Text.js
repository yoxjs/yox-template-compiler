
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 文本节点
 *
 * @param {*} content
 */
export default class Text extends Node {

  constructor(content) {
    super(nodeType.TEXT)
    this.content = content
  }

}
