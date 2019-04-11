import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import * as exprExecutor from 'yox-expression-compiler/src/executor'

import isDef from 'yox-common/function/isDef'
import Keypath from 'yox-expression-compiler/src/node/Keypath';

export const ELEMENT = '_c'

export const COMPONENT = '_d'

export const EACH = '_l'

export const EMPTY = '_e'

export const COMMENT = '_m'

export const EXPRESSION = '_x'

export const CHILDREN = '_v'

/**
 * nodes 是动态计算出来的节点，因此节点本身可能是数组
 * 这里的数组不是从 `数据` 取来的，而是一个结构性的数组
 * 节点本身也可能是空，即 EMPTY renderer 返回的结果
 */
function addNodes(list: any[], nodes: Node[]) {
  array.each(
    nodes,
    function (node) {
      // 某些节点计算得到空值，需要过滤
      if (isDef(node)) {
        array.push(list, node)
      }
    }
  )
}

function renderEmpty() {
  return env.UNDEFINED
}

function renderChildren(nodes: Node[]) {
  const list = []
  addNodes(list, nodes)
  return list
}

export function render(
  instance: any,
  result: Function,
  createElement: (tag: string, data?: any[] | Object, children?: any[]) => any,
  createComponent: (tag: string, data?: Object) => any,
  createComment: (comment?: string) => any,
) {

  let scope: any = {},

  keypath = char.CHAR_BLANK,

  keypathStack = [keypath, scope],

  format = function (key: string) {

    // 初始查找位置
    // keypathStack 的结构是 keypath, scope 作为一组
    let index = keypathStack.length - 2,

    formateds = []

    // 格式化 key
    keypathUtil.each(
      key,
      function (item: string | number) {
        if (item === env.KEYPATH_PRIVATE_PARENT) {
          index -= 2
        }
        else if (item !== env.KEYPATH_PRIVATE_CURRENT) {
          array.push(formateds, item)
        }
      }
    )

    return { formated: array.join(formateds, env.KEYPATH_SEPARATOR), index }

  },

  lookup = function (key: string, node: Keypath): any {

    let value: any,

    // 最终找到值的 keypath
    absoluteKeypath: string | void,

    // 是否向上查找
    lookup = node.lookup,

    // 格式化数据
    { formated, index } = format(key),

    getKeypath = function () {

      let keypath = keypathUtil.join(keypathStack[index], formated)
      if (!absoluteKeypath) {
        absoluteKeypath = keypath
      }
      let scope = keypathStack[index + 1]

      // #each 时，scope 存储是当前循环的数据，如 keypath、index 等
      // scope 无法直接拿到当前数组项，它存在于 scope[ 'this' ] 上
      // 为什么这样设计呢？
      // 因为 {{this}} 的存在，经过上面的格式化，key 会是 ''
      // 而 {{this.length}} 会变成 'length'

      // 如果取的是 scope 上直接有的数据，如 keypath
      if (object.has(scope, formated)) {
        value = scope[formated]
        return keypath
      }
      // 如果取的是数组项，则要更进一步
      else if (object.has(scope, env.RAW_THIS)) {
        scope = scope[env.RAW_THIS]

        // 到这里 scope 可能为空
        // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

        // 取 this
        if (formated === char.CHAR_BLANK) {
          value = scope
          return keypath
        }
        // 取 this.xx
        else if (scope && object.has(scope, formated)) {
          value = scope[formated]
          return keypath
        }
      }

      // 正常取数据
      value = instance.get(keypath, getKeypath)
      if (value === getKeypath) {
        if (lookup && index > 0) {
          index--
          return getKeypath()
        }
      }
      else {
        return keypath
      }

    },

    keypath = getKeypath()

    if (isDef(keypath)) {
      absoluteKeypath = keypath
    }
    else {
      value = env.UNDEFINED
      if (filters) {
        let result = object.get(filters, key)
        if (result) {
          value = result[env.RAW_VALUE]
        }
      }
    }

    node[env.RAW_ABSOLUTE_KEYPATH] = absoluteKeypath

    return value

  }

  return result(
    renderEmpty,
    createComment,
    renderChildren,
    createComponent,
    createElement,
    function (expr: ExpressionNode) {
      value = exprExecutor.execute(expr, lookup, instance)
    },
    function (expr: ExpressionNode, index: string | Function, callback?: Function) {

      if (is.func(index)) {
        callback = index as Function
        index = env.UNDEFINED
      }

      const list = [],

      value = get(expr),

      absoluteKeypath = expr.absoluteKeypath,

      eachKeypath = absoluteKeypath || keypathUtil.join(keypath, expr.raw),

      eachHandler = function (item: any, key: string | number) {

        let lastScope = scope, lastKeypath = keypath, lastKeypathStack = keypathStack

        scope = {}
        keypath = keypathUtil.join(eachKeypath, key)
        keypathStack = object.copy(keypathStack)

        array.push(keypathStack, keypath)
        array.push(keypathStack, scope)

        // 从下面这几句赋值可以看出
        // scope 至少会有 'keypath' 'this' 'index' 等几个值
        scope.keypath = keypath

        // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
        // 因为通过 instance.get() 无法获取数据
        if (!absoluteKeypath) {
          scope[env.RAW_THIS] = item
        }

        if (index) {
          scope[index as string] = key
        }

        addNodes(list, callback(item, key))

        scope = lastScope
        keypath = lastKeypath
        keypathStack = lastKeypathStack

      }

      if (is.array(value)) {
        array.each(value, eachHandler)
      }
      else if (is.object(value)) {
        object.each(value, eachHandler)
      }
      else if (is.func(value)) {
        value(eachHandler)
      }

      return list

    }
  )
}