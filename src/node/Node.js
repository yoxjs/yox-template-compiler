
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import Expression from 'yox-expression-compiler/src/node/Node'

/**
 * 节点基类
 */
export default class Node {

  constructor(type) {
    this.type = type
  }

  stringify() {
    return this.stringifyObject(this)
  }

  stringifyObject(obj) {
    let me = this, result = [ ]
    if (obj) {
      object.each(
        obj,
        function (value, key) {
          if (value == env.NULL) {
            return
          }
          if (value.stringify) {
            value = value.stringify()
          }
          else if (is.string(value)) {
            value = `'${value}'`
          }
          else if (is.array(value)) {
            value = me.stringifyArray(value)
          }
          else if (value instanceof Expression) {
            value = me.stringifyExpression(value)
          }
          else if (is.object(value)) {
            value = me.stringifyObject(value)
          }
          array.push(result, `${key}:${value}`)
        }
      )
    }
    return `{${result.join(',')}}`
  }

  stringifyArray(arr) {
    let me = this, result = [ ]
    if (arr) {
      array.each(
        arr,
        function (item) {
          if (item.stringify) {
            item = item.stringify()
          }
          else if (is.object(item)) {
            item = me.stringifyObject(item)
          }
          array.push(result, item)
        }
      )
    }
    return `[${result.join(',')}]`
  }

  stringifyExpression(expr, safe) {
    if (expr) {
      return 'o(' + this.stringifyObject(expr) + (safe === env.FALSE ? ',true)' : ')')
    }
  }

  stringifyCall(name, params) {
    return `${name}(${params.join(',')})`
  }

}
