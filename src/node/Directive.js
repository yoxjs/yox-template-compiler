
import * as env from 'yox-common/util/env'

import Node from './Node'
import * as nodeType from '../nodeType'

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
    this[ env.RAW_NAME ] = name
    if (modifier) {
      this.modifier = modifier
    }
  }

}
