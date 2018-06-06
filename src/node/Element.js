
import stringifyJSON from 'yox-common/function/stringifyJSON'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import Node from './Node'
import * as helper from '../helper'
import * as nodeType from '../nodeType'

/**
 * 元素节点
 *
 * @param {string} tag
 * @param {?boolean} component 是否是组件
 */
export default class Element extends Node {

  constructor(tag, component) {
    super(nodeType.ELEMENT)
    this.tag = tag
    if (component) {
      this.component = component
    }
  }

  stringify() {

    let me = this
    let { tag, divider, component, props, slot, name, key, ref, transition } = me

    let params = [ ], attrs = [ ], children = [ ]

    if (me[ env.RAW_CHILDREN ]) {
      array.each(
        me[ env.RAW_CHILDREN ],
        function (child, index) {
          array.push(
            index < divider ? attrs : children,
            child
          )
        }
      )
    }

    let addParam = function (arr, name) {
      arr = helper.stringifyArray(arr, name || 'x')
      array.unshift(
        params,
        arr
        ? helper.stringifyFunction(arr)
        : env.RAW_UNDEFINED
      )
    }

    if (tag === 'template') {
      if (slot && children[ env.RAW_LENGTH ]) {
        addParam(children)
        addParam(slot)
        return helper.stringifyCall('a', params)
      }
    }
    else if (tag === 'slot') {
      if (name) {
        addParam(name)
        return helper.stringifyCall('b', params)
      }
    }
    else {

      if (key) {
        addParam(key)
      }

      if (transition || params[ env.RAW_LENGTH ]) {
        addParam(transition)
      }

      if (ref || params[ env.RAW_LENGTH ]) {
        addParam(ref)
      }

      if (props && props[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addParam(props, 'z')
      }

      if (attrs[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addParam(attrs, 'y')
      }

      if (children[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addParam(children)
      }

      array.unshift(params, stringifyJSON(tag))
      array.unshift(params, component ? 1 : 0)

      return helper.stringifyCall('c', params)

    }

  }

}
