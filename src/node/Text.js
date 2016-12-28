
import Node from './Node'
import * as nodeType from '../nodeType'

import * as env from 'yox-common/util/env'

/**
 * 文本节点
 *
 * @param {*} content
 */
export default class Text extends Node {

  constructor(content) {
    super(nodeType.TEXT, env.FALSE)
    this.content = content
  }

}
