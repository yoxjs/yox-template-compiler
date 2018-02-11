
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import Node from './Node'
import * as nodeType from '../nodeType'

/**
 * 元素节点
 *
 * @param {string} name
 * @param {?boolean} component 是否是组件
 */
export default class Element extends Node {

  constructor(name, component) {
    super(nodeType.ELEMENT)
    this.name = name
    if (component) {
      this.component = component
    }
  }

  stringify() {

    let me = this
    let { name, divider, component, props, key, ref } = me

    let params = [ ], attrs = [ ], children = [ ]

    if (me.children) {
      array.each(
        me.children,
        function (child, index) {
          array.push(
            index < divider ? attrs : children,
            child.stringify()
          )
        }
      )
    }

    let addArray = function (arr, name) {
      arr = me.stringifyArray(arr, name)
      array.unshift(
        params,
        arr
        ? me.stringifyFunction(arr)
        : 0
      )
    }

    // 反过来
    // 这样序列化能省更多字符
    if (key) {
      addArray(key)
    }

    if (ref || params[ env.RAW_LENGTH ]) {
      addArray(ref)
    }

    if (children[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
      addArray(children)
    }

    if (attrs[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
      addArray(attrs, 'y')
    }

    if (props && props[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
      addArray(props, 'z')
    }

    array.unshift(params, me.stringifyString(name))
    array.unshift(params, component ? 1 : 0)

    return this.stringifyCall('c', params)

  }

}
