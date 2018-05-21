
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import Node from './Node'
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
            child.stringify()
          )
        }
      )
    }

    let addArray = function (arr, name) {
      arr = me.stringifyArray(arr, name || 'x')
      array.unshift(
        params,
        arr
        ? me.stringifyFunction(arr)
        : env.RAW_UNDEFINED
      )
    }

    if (tag === 'template') {
      if (slot && children[ env.RAW_LENGTH ]) {
        addArray(children)
        addArray(slot)
        return this.stringifyCall('a', params)
      }
    }
    else if (tag === 'slot') {
      if (name) {
        addArray(name)
        return this.stringifyCall('b', params)
      }
    }
    else {

      if (key) {
        addArray(key)
      }

      if (transition || params[ env.RAW_LENGTH ]) {
        addArray(transition)
      }

      if (ref || params[ env.RAW_LENGTH ]) {
        addArray(ref)
      }

      if (props && props[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addArray(props, 'z')
      }

      if (attrs[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addArray(attrs, 'y')
      }

      if (children[ env.RAW_LENGTH ] || params[ env.RAW_LENGTH ]) {
        addArray(children)
      }

      array.unshift(params, me.stringifyString(tag))
      array.unshift(params, component ? 1 : 0)

      return this.stringifyCall('c', params)

    }

  }

}
