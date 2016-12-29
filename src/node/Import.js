
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * import 节点
 *
 * @param {string} name
 */
export default class Import extends Node {

  constructor(name) {
    super(nodeType.IMPORT)
    this.name = name
  }

}
