
import stringifyJSON from 'yox-common/function/stringifyJSON'
import * as env from 'yox-common/util/env'

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
    this[ env.RAW_TEXT ] = text
  }

  stringify() {
    return stringifyJSON(this[ env.RAW_TEXT ])
  }

}
