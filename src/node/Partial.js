
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * Partial 节点
 *
 * @param {string} name
 */
export default class Partial extends Node {

  constructor(name) {
    super(nodeType.PARTIAL)
    this.name = name
  }

  stringify() {
    return this.stringifyCall(
      'p',
      [
        `'${this.name}'`,
        this.stringifyArray(this.children)
      ]
    )
  }

}
