
import Node from './Node'
import * as nodeType from '../nodeType'

import * as string from 'yox-common/util/string'

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
    this.name = string.camelCase(name)
    if (modifier) {
      this.modifier = string.camelCase(modifier)
    }
  }

}
