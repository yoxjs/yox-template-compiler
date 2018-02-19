
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

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
    if (obj) {
      let keys = object.keys(obj)
      if (keys[ env.RAW_LENGTH ]) {
        let me = this, result
        array.each(
          keys,
          function (key) {
            let value = obj[ key ]
            if (value == env.NULL) {
              return
            }
            if (is.string(value)) {
              value = me.stringifyString(value)
            }
            else {
              if (is.array(value)) {
                if (key === 'children') {
                  value = me.stringifyArray(value, 'x')
                  if (value) {
                    value = me.stringifyFunction(value)
                  }
                }
                else {
                  value = me.stringifyArray(value)
                }
              }
              else if (is.object(value)) {
                value = me.stringifyObject(value)
              }
              if (value == env.NULL) {
                return
              }
            }
            if (!result) {
              result = [ ]
            }
            array.push(result, `${key}:${value}`)
          }
        )
        if (result) {
          return `{${array.join(result, ',')}}`
        }
      }
    }
  }

  stringifyArray(arr, name) {
    if (arr && arr[ env.RAW_LENGTH ]) {
      let me = this, result = [ ]
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
      return name
        ? me.stringifyCall(name, result)
        : `[${array.join(result, ',')}]`
    }
  }

  stringifyExpression(expr, safe) {
    if (expr) {
      return this.stringifyCall('o', this.stringifyObject(expr))
    }
  }

  stringifyCall(name, params) {
    return `${name}(${is.array(params) ? array.join(params, ',') : params})`
  }

  stringifyString(str) {
    return `"${str.replace(/"/g, '\\"').replace(/\s*\n+\s*/g, ' ')}"`
  }

  stringifyFunction(str) {
    return `function(){${str || ''}}`
  }

}
