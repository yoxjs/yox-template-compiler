
import Node from './Node'
import * as nodeType from '../nodeType'

import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

/**
 * 指令节点
 *
 * on-click="submit"  name 是 subName 是 click，value 是 submit
 *
 * @param {string} name 指令名
 * @param {string} subName 指令子名
 * @param {?*} value 指令值
 */
export default class Directive extends Node {

  constructor(options) {
    super(nodeType.DIRECTIVE, !object.has(options, 'value'))
    object.extend(this, options)
  }

  render(data) {
    return new Directive({
      name: this.name,
      subName: this.subName,
      value: this.renderTexts(data),
      keypath: keypathUtil.stringify(data.keys),
    })
  }

}
