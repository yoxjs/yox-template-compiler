
import * as is from 'yox-common/util/is'
import * as array from 'yox-common/util/array'

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
    let { name, divider, component, key, ref } = me

    let params = [ `'${name}'` ], props = { }, attrs = [ ], children = [ ]

    if (me.props) {
      object.each(
        me.props,
        function (value, key) {
          props[ key ] = Expression.is(value)
            ? me.stringifyObject(value)
            : value
        }
      )
    }

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

    array.push(params, this.stringifyArray(attrs))
    array.push(params, this.stringifyObject(props))
    array.push(params, this.stringifyArray(children))
    array.push(params, component ? 1 : 0)

    let stringify = function (value) {
      if (is.array(value)) {
        return me.stringifyArray(value)
      }
      else if (Expression.is(value)) {
        return me.stringfiyExpression(value)
      }
      else if (is.string(value)) {
        return `'${value}'`
      }
      return value
    }
    if (key) {
      array.push(params, stringify(key))
    }
    if (ref) {
      array.push(params, stringify(ref))
    }

    return this.stringifyCall('c', params)
  }

}
