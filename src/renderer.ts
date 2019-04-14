import * as config from 'yox-config'

import isDef from 'yox-common/function/isDef'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Keypath from 'yox-expression-compiler/src/node/Keypath'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as exprExecutor from 'yox-expression-compiler/src/executor'

import * as nodeType from './nodeType'

import Attribute from './render/Attribute'
import Property from './render/Property'
import Directive from './render/Directive'
import Event from './render/Event'
import Lazy from './render/Lazy'
import Bind from './render/Bind'
import Model from './render/Model'

/**
 * nodes 是动态计算出来的节点，因此节点本身可能是数组
 * 这里的数组不是从 `数据` 取来的，而是一个结构性的数组
 * 节点本身也可能是空，即 EMPTY renderer 返回的结果
 */
function addNodes(list: any[], nodes: Node[]) {
  // [TODO] 连续的 string/number/boolean/null 合并成一个节点
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
  createElement: (tag: string, data: Object, children?: string | any[]) => any
) {

  let keypath = env.EMPTY_STRING,

  scope: any = { keypath },

  keypathStack = [keypath, scope],

  localPartials = {},

  format = function (key: string) {

    // 初始查找位置
    // keypathStack 的结构是 keypath, scope 作为一组
    let index = keypathStack.length - 2, formateds = []

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

    return {
      formated: array.join(formateds, env.KEYPATH_SEPARATOR),
      index
    }

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

      let keypath = keypathUtil.join(keypathStack[index], formated),

      scope = keypathStack[index + 1]

      if (!absoluteKeypath) {
        absoluteKeypath = keypath
      }

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
      else if (object.has(scope, 'item')) {
        scope = scope.item

        // 到这里 scope 可能为空
        // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

        // 取 this
        if (formated === env.EMPTY_STRING) {
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
      value = instance.filter(formated)
    }

    node.absoluteKeypath = absoluteKeypath

    return value

  },

  get = function (expr: ExpressionNode): any {
    return exprExecutor.execute(expr, lookup, instance)
  }


  return result(
    renderEmpty,
    renderChildren,
    get,
    function (tag: string, data: Record<string, any>, attrs: any[], children?: string | any[]) {

      if (attrs.length) {

        let props: Record<string, any> = {},

        nativeProps: Record<string, Property> = {},

        nativeAttrs: Record<string, Attribute> = {},

        on: Record<string, Event> = {},

        bind: Record<string, Bind> = {},

        lazy: Record<string, Lazy> = {},

        directives: Record<string, Directive> = {},

        model: Model | void

        array.each(
          data.attrs,
          function (attr: any) {
            const name = attr.name
            if (attr.type === nodeType.ATTRIBUTE) {
              if (data.isComponent) {
                props[name] = attr.value
              }
              else {
                nativeAttrs[name] = {
                  namespace: attr.component,
                  value: attr.value,
                }
              }
            }
            else if (attr.type === nodeType.PROPERTY) {
              nativeProps[name] = {
                hint: attr.hint,
                value: attr.value,
              }
            }
            else if (attr.type === nodeType.DIRECTIVE) {
              if (name === config.DIRECTIVE_EVENT) {
                on[name] = {
                  name,
                  event: attr.event,
                  method: attr.method,
                  args: attr.args,
                }
              }
              else if (name === config.DIRECTIVE_MODEL) {
                model = {
                  name,
                  value: get(attr.expr),
                  keypath: attr.absoluteKeypath,
                }
              }
              else if (name === config.DIRECTIVE_BIND) {
                bind[name] = {
                  name,
                  value: get(attr.expr),
                  keypath: attr.absoluteKeypath,
                }
              }
              else if (name === config.DIRECTIVE_LAZY) {
                lazy[name] = {
                  name,
                  value: attr.value,
                }
              }
              else {
                directives[name] = {
                  name,
                  modifier: attr.modifier,
                  value: attr.value,
                  expr: attr.expr,
                }
              }
            }
            else if (attr.type === nodeType.SPREAD) {
              const expr = attr.expr, value = get(expr)
              // 数组也算一种对象
              if (is.object(value) && !is.array(value)) {
                object.each(
                  value,
                  function (value: any, key: string) {
                    props[key] = value
                  }
                )
                // [TODO] 绑定
                const absoluteKeypath = expr[env.RAW_ABSOLUTE_KEYPATH]

              }
              else {
                logger.warn(`[${expr.raw}] 不是对象，延展个毛啊`)
              }
            }
          }
        )

        data.props = props
        data.nativeAttrs = nativeAttrs
        data.nativeProps = nativeProps
        data.directives = directives
        data.on = on
        data.bind = bind
        data.lazy = lazy
        data.model = model

      }

      return createElement(
        tag,
        data,
        children
      )
    },
    function (name: string, generate: Function) {
      localPartials[name] = generate
    },
    function (name: string) {
      if (localPartials[name]) {
        return localPartials[name]()
      }
      else {
        const partial = instance.partial(name)
        if (partial) {
          return partial()
        }
      }
      logger.fatal(`"${name}" partial is not found.`)
    },
    function (expr: ExpressionNode, index: string | Function, callback?: Function) {

      if (is.func(index)) {
        callback = index as Function
        index = env.UNDEFINED
      }

      const list = [],

      value = get(expr),

      absoluteKeypath = expr[env.RAW_ABSOLUTE_KEYPATH],

      eachKeypath = absoluteKeypath || keypathUtil.join(keypath, expr.raw),

      eachHandler = function (item: any, key: string | number) {

        let lastScope = scope, lastKeypath = keypath, lastKeypathStack = keypathStack

        scope = {}
        keypath = keypathUtil.join(eachKeypath, key)
        keypathStack = object.copy(keypathStack)

        array.push(keypathStack, keypath)
        array.push(keypathStack, scope)

        // 从下面这几句赋值可以看出
        // scope 至少会有 'keypath' 'item' 'index' 等几个值
        scope.keypath = keypath

        // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
        // 因为通过 instance.get() 无法获取数据
        if (!absoluteKeypath) {
          scope.item = item
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