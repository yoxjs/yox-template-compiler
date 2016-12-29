
import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 指令节点
 *
 * on-click="submit"  name 是 event, subName 是 click，value 是 submit
 *
 * @param {string} name 指令名
 * @param {?string} subName 指令子名
 * @param {?*} value 指令值
 */
export default class Directive extends Node {

  constructor(name, subName, value) {
    super(nodeType.DIRECTIVE)
    this.name = name
    this.subName = subName
    this.value = value
  }

}
