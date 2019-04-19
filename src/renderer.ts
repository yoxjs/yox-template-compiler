import * as config from 'yox-config'

import isDef from 'yox-common/function/isDef'
import execute from 'yox-common/function/execute'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import Event from 'yox-common/util/Event'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Keypath from 'yox-expression-compiler/src/node/Keypath'

import * as exprExecutor from 'yox-expression-compiler/src/executor'

import * as signature from 'yox-type/src/type'

import Yox from 'yox-type/src/Yox'
import VNode from 'yox-type/src/vnode/VNode'
import Attribute from 'yox-type/src/vnode/Attribute'
import Property from 'yox-type/src/vnode/Property'
import Directive from 'yox-type/src/vnode/Directive'
import DirectiveHooks from 'yox-type/src/hooks/Directive'
import TransitionHooks from 'yox-type/src/hooks/Transition'

import * as nodeType from './nodeType'

/**
 * nodes 是动态计算出来的节点，因此节点本身可能是数组
 * 这里的数组不是从 `数据` 取来的，而是一个结构性的数组
 * 节点本身也可能是空，即 EMPTY renderer 返回的结果
 */
function addNodes(list: any[], nodes: VNode[]) {
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
  return env.EMPTY_STRING
}

function renderChildren(nodes: VNode[]) {
  const list = []
  addNodes(list, nodes)
  return list
}

export function render(instance: Yox, result: Function) {

  let keypath = env.EMPTY_STRING,

  scope: any = { keypath },

  stack = [keypath, scope],

  eventScope: any,

  localPartials = {},

  format = function (key: string) {

    // 初始查找位置
    // stack 的结构是 keypath, scope 作为一组
    let index = stack.length - 2, formateds = []

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

      let keypath = keypathUtil.join(stack[index], formated),

      scope = stack[index + 1]

      if (!absoluteKeypath) {
        absoluteKeypath = keypath
      }

      // #each 时，scope 存储是当前循环的数据，如 keypath、index 等
      // scope 无法直接拿到当前数组项，它存在于 scope.item 上
      // 为什么这样设计呢？
      // 因为 {{this}} 的存在，经过上面的格式化，key 会是 ''
      // 而 {{this.length}} 会变成 'length'

      if (eventScope && object.has(eventScope, formated)) {
        value = scope[formated]
        return keypath
      }

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

    if (absoluteKeypath) {
      node.absoluteKeypath = absoluteKeypath
    }

    return value

  },

  renderValue = function (expr: ExpressionNode, simple?: boolean): any {
    return exprExecutor.execute(expr, lookup, instance)
  },

  getBindingValue = function (expr: Keypath) {
    const value = renderValue(expr, env.TRUE), binding = expr.absoluteKeypath
    if (!binding) {
      logger.warn(`can't find value by the keypath "${expr.raw}".`)
    }
    return {
      value,
      binding,
    }
  },

  createEventListener = function (type: string): signature.eventListener {
    return function (event: Event, data?: Record<string, any>) {
      if (event.type !== type) {
        event = new Event(type, event)
      }
      instance.fire(event, data)
    }
  },

  createMethodListener = function (method: string, args: Function | void): signature.directiveHandler {
    return function (event?: Event, data?: Record<string, any>) {

      const callee = instance[method]

      if (event instanceof Event) {

        let result: any | void

        if (args) {
          // 给当前 scope 加上 event 和 data
          eventScope = {
            $event: event,
            $data: data,
          }
          result = execute(callee, instance, args())
          // 阅后即焚
          eventScope = env.UNDEFINED
        }
        else {
          result = execute(callee, instance, data ? [event, data] : event)
        }

        if (result === env.FALSE) {
          event.prevent().stop()
        }
      }
      else {
        args
        ? execute(callee, instance, args())
        : execute(callee, instance)
      }

    }
  }


  return result(
    renderEmpty,
    renderChildren,
    renderValue,
    function (vnode: Record<string, any>, attrs: any[] | void) {

      if (attrs) {

        let props: Record<string, any> = {},

        nativeProps: Record<string, Property> = {},

        nativeAttrs: Record<string, Attribute> = {},

        directives: Record<string, Directive> = {},

        lazy: Record<string, number | boolean> | void,

        model: any | void,

        addBindingIfNeeded = function (attr: Record<string, any>): any {

          const result = getBindingValue(attr.expr)

          if (is.string(result.binding)) {
            const key = keypathUtil.join(config.DIRECTIVE_BINDING, attr.name),
            hooks = instance.directive(config.DIRECTIVE_BINDING)
            if (hooks) {
              directives[key] = {
                type: config.DIRECTIVE_BINDING,
                name: attr.name,
                key,
                hooks,
                binding: result.binding,
                hint: attr.hint,
              }
            }
          }

          return result.value

        },

        parseDirective = function (attr: Record<string, any>) {

          let { name, modifier, value } = attr,

          key = keypathUtil.join(name, modifier),

          binding: string | void,

          hooks: DirectiveHooks | void,

          getter: signature.directiveGetter | void,

          handler: signature.directiveHandler | void,

          transition: TransitionHooks | void

          switch (name) {

            case config.DIRECTIVE_EVENT:
              hooks = instance.directive(config.DIRECTIVE_EVENT)
              handler = attr.event
                ? createEventListener(attr.event)
                : createMethodListener(attr.method, attr.args)
              break

            case env.RAW_TRANSITION:
              transition = instance.transition(value)
              if (transition) {
                vnode.transition = transition
              }
              else {
                logger.fatal(`transition [${value}] is not found.`)
              }
              return

            case config.DIRECTIVE_MODEL:
              hooks = instance.directive(config.DIRECTIVE_MODEL)
              const result = getBindingValue(attr.expr)
              if (is.string(result.binding)) {
                binding = result.binding
                model = result.value
              }
              break

            case config.DIRECTIVE_LAZY:
              // 惰性初始化，后续的判断可以直接 if (lazy)
              // 而不必判断 if (!object.empty(lazy))
              if (!lazy) {
                lazy = {}
              }
              lazy[modifier] = value
              return

            default:
              hooks = instance.directive(modifier)
              if (attr.method) {
                handler = createMethodListener(attr.method, attr.args)
              }
              else {
                getter = attr.getter
              }
              break

          }

          if (hooks) {
            directives[key] = {
              type: name,
              name: modifier,
              key,
              value,
              binding,
              hooks,
              getter,
              handler
            }
          }
          else {
            logger.fatal(`directive [${key}] is not found.`)
          }

        },

        spreadObject = function (attr: Record<string, any>) {

          let { expr } = attr,

          value = renderValue(expr, attr.binding)

          // 数组也算一种对象，要排除掉
          if (is.object(value) && !is.array(value)) {

            object.each(
              value,
              function (value: any, key: string) {
                props[key] = value
              }
            )

            const absoluteKeypath = expr[env.RAW_ABSOLUTE_KEYPATH]
            if (absoluteKeypath) {
              const key = keypathUtil.join(config.DIRECTIVE_BINDING, absoluteKeypath),
              hooks = instance.directive(config.DIRECTIVE_BINDING)
              if (hooks) {
                directives[key] = {
                  type: config.DIRECTIVE_BINDING,
                  name: env.EMPTY_STRING,
                  key,
                  hooks,
                  binding: keypathUtil.join(absoluteKeypath, '*'),
                }
              }
            }

          }
          else {
            logger.warn(`[${expr.raw}] 不是对象，延展个毛啊`)
          }
        }

        array.each(
          attrs,
          function (attr: any) {

            let { name, value } = attr

            switch (attr.type) {

              case nodeType.ATTRIBUTE:

                if (attr.binding) {
                  value = addBindingIfNeeded(attr)
                }

                if (vnode.isComponent) {
                  props[name] = value
                }
                else {
                  nativeAttrs[name] = { name, value }
                }

                break

              case nodeType.PROPERTY:

                if (attr.binding) {
                  value = addBindingIfNeeded(attr)
                }

                nativeProps[name] = {
                  name,
                  value,
                  hint: attr.hint,
                }

                break

              case nodeType.DIRECTIVE:
                parseDirective(attr)
                break

              case nodeType.SPREAD:
                spreadObject(attr)
                break

            }
          }
        )

        // lazy 最初的设计是和 on- 指令搭配使用
        // 开发过程中，发现可以把 `函数调用` 相关的指令都编译成 handler
        // 于是 lazy 的使用范围就自然放开，只要指令有 handler 就行
        // 比如：<div o-tap="method()" lazy-tap> 也能完美匹配
        if (lazy) {
          // 如果没写 lazy，默认为 false
          // 如果只写了 lazy，没写应用于谁，比如 <div lazy>，默认应用于全部 handler 指令
          const defaultLazy = lazy[env.EMPTY_STRING] || env.FALSE
          object.each(
            directives,
            function (directive: Directive) {
              if (directive.handler) {
                directive.lazy = lazy[directive.name] || defaultLazy
              }
            }
          )
        }

        vnode.props = props
        vnode.nativeAttrs = nativeAttrs
        vnode.nativeProps = nativeProps
        vnode.directives = directives
        vnode.model = model

      }

      vnode.instance = instance
      vnode.keypath = keypath

      return vnode

    },
    // <slot name="xx"/>
    function (name: string) {
      const result = instance.get(config.SLOT_DATA_PREFIX + name)
      return is.array(result) && result.length === 1
        ? result[0]
        : result
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
      logger.fatal(`partial "${name}" is not found.`)
    },
    function (expr: ExpressionNode, index: string | Function, callback?: Function) {

      if (is.func(index)) {
        callback = index as Function
        index = env.UNDEFINED
      }

      const list = [],

      value = renderValue(expr),

      absoluteKeypath = expr[env.RAW_ABSOLUTE_KEYPATH],

      eachKeypath = absoluteKeypath || keypathUtil.join(keypath, expr.raw),

      eachHandler = function (item: any, key: string | number) {

        let lastScope = scope, lastKeypath = keypath, lastKeypathStack = stack

        scope = {}
        keypath = keypathUtil.join(eachKeypath, key)
        stack = object.copy(stack)

        array.push(stack, keypath)
        array.push(stack, scope)

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
        stack = lastKeypathStack

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