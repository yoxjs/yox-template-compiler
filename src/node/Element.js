
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import Expression from 'yox-expression-compiler/src/node/Node'

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

    // 反过来 push
    // 这样序列化能省更多字符
    if (key || ref) {
      let stringify = function (value) {
        if (is.array(value)) {
          return me.stringifyArray(value, env.TRUE)
        }
        else if (Expression.is(value)) {
          return me.stringifyExpression(value)
        }
        else if (is.string(value)) {
          return me.stringifyString(value)
        }
        return value
      }
      if (key) {
        array.unshift(params, stringify(key))
      }
      if (ref || params.length) {
        array.unshift(params, ref ? stringify(ref) : env.RAW_NULL)
      }
    }

    if (component || params.length) {
      array.unshift(params, component ? 1 : 0)
    }

    if (children.length || params.length) {
      array.unshift(params, children.length ? this.stringifyArray(children) : 0)
    }

    if (props || params.length) {
      array.unshift(params, props ? this.stringifyObject(props) : 0)
    }

    if (attrs.length || params.length) {
      array.unshift(params, attrs.length ? this.stringifyArray(attrs) : 0)
    }

    array.unshift(params, me.stringifyString(name))

    return this.stringifyCall('c', params)
  }

}
