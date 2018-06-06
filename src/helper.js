
import stringifyJSON from 'yox-common/function/stringifyJSON'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import * as config from 'yox-config'

import * as nodeType from './nodeType'

// if 带条件的
export const ifTypes = { }
// if 分支的
export const elseTypes = { }
// html 层级的节点类型
export const htmlTypes = { }
// 叶子节点类型
export const leafTypes = { }
// 内置指令，无需加前缀
export const builtInDirectives = { }
// 名称 -> 类型的映射
export const name2Type = { }
// 类型 -> 名称的映射
export const type2Name = { }

ifTypes[ nodeType.IF ] =
ifTypes[ nodeType.ELSE_IF ] =

elseTypes[ nodeType.ELSE_IF ] =
elseTypes[ nodeType.ELSE ] =

htmlTypes[ nodeType.ELEMENT ] =
htmlTypes[ nodeType.ATTRIBUTE ] =
htmlTypes[ nodeType.DIRECTIVE ] =

leafTypes[ nodeType.TEXT ] =
leafTypes[ nodeType.IMPORT ] =
leafTypes[ nodeType.SPREAD ] =
leafTypes[ nodeType.EXPRESSION ] =

builtInDirectives[ config.DIRECTIVE_LAZY ] =
builtInDirectives[ config.DIRECTIVE_MODEL ] = env.TRUE

name2Type[ 'if' ] = nodeType.IF
name2Type[ 'each' ] = nodeType.EACH
name2Type[ 'partial' ] = nodeType.PARTIAL

object.each(
  name2Type,
  function (type, name) {
    type2Name[ type ] = name
  }
)

export function stringifyObject(obj) {
  if (obj) {
    let keys = object.keys(obj)
    if (keys[ env.RAW_LENGTH ]) {
      let result = [ ]
      array.each(
        keys,
        function (key) {
          let value = obj[ key ]
          if (is.string(value)) {
            value = stringifyJSON(value)
          }
          else if (is.array(value)) {
            if (key === env.RAW_CHILDREN) {
              value = stringifyArray(value, 'x')
              if (value) {
                value = stringifyFunction(value)
              }
            }
            else {
              value = stringifyArray(value)
            }
          }
          else if (is.object(value)) {
            value = stringifyObject(value)
          }
          if (value == env.NULL) {
            return
          }
          array.push(result, `${key}:${value}`)
        }
      )
      if (result[ env.RAW_LENGTH ]) {
        return `{${array.join(result, char.CHAR_COMMA)}}`
      }
    }
  }
}

export function stringifyArray(arr, name) {
  if (arr && arr[ env.RAW_LENGTH ]) {
    let result = arr.map(
      function (item) {
        if (item.stringify) {
          return item.stringify()
        }
        if (is.string(item)) {
          return stringifyJSON(item)
        }
        if (is.object(item)) {
          return stringifyObject(item)
        }
        return item
      }
    )
    return name
      ? stringifyCall(name, result)
      : `[${array.join(result, char.CHAR_COMMA)}]`
  }
}

export function stringifyExpression(expr) {
  if (expr) {
    return stringifyCall('o', stringifyJSON(expr))
  }
}

export function stringifyCall(name, params) {
  return `${name}(${is.array(params) ? array.join(params, char.CHAR_COMMA) : params})`
}

export function stringifyFunction(str) {
  return `function(){${str || char.CHAR_BLANK}}`
}