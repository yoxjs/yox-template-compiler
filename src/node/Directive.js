
import Node from './Node'
import * as nodeType from '../nodeType'

import * as string from 'yox-common/util/string'

/**
 * 指令节点
 *
 * on-click="submit"  name 是 event, subName 是 click，value 是 submit
 *
 * @param {string} name 指令名
 * @param {?string} subName 指令子名
 */
export default class Directive extends Node {

  constructor(name, subName) {
    super(nodeType.DIRECTIVE)
    this.name = string.camelCase(name)
    if (subName) {
      this.subName = string.camelCase(subName)
    }
  }

}
