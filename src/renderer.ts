import * as config from 'yox-config/index'

import isDef from 'yox-common/src/function/isDef'
import execute from 'yox-common/src/function/execute'
import toString from 'yox-common/src/function/toString'

import * as is from 'yox-common/src/util/is'
import * as env from 'yox-common/src/util/env'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as logger from 'yox-common/src/util/logger'
import * as keypathUtil from 'yox-common/src/util/keypath'

import Event from 'yox-common/src/util/Event'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Keypath from 'yox-expression-compiler/src/node/Keypath'

import * as exprExecutor from 'yox-expression-compiler/src/executor'

import * as signature from 'yox-type/index'

import Yox from 'yox-type/src/Yox'
import VNode from 'yox-type/src/vnode/VNode'
import DirectiveHooks from 'yox-type/src/hooks/Directive'
import TransitionHooks from 'yox-type/src/hooks/Transition'

import * as nodeType from './nodeType'

export function render(context: Yox, result: Function) {

  let $keypath = env.EMPTY_STRING,

  $scope: any = { $keypath },

  $stack = [$keypath, $scope],

  eventScope: Record<string, any> | void,

  vnodeStack: VNode[][] = [],

  vnodeList: VNode[] | void,

  localPartials = {},

  getKeypath = function (stack: any[], index: number, key: string, lookup: boolean, callback: (keypath: string, value?: any) => any, defaultKeypath?: string) {

    let keypath = keypathUtil.join(stack[index], key),

    scope = stack[index + 1]

    // 如果最后还是取不到值，用回最初的 keypath
    if (!isDef(defaultKeypath)) {
      defaultKeypath = keypath
    }

    if (eventScope && object.has(eventScope, key)) {
      return callback(keypath, eventScope[key])
    }

    // 如果取的是 scope 上直接有的数据，如 keypath
    if (object.has(scope, key)) {
      return callback(keypath, scope[key])
    }

    // 如果取的是数组项，则要更进一步
    if (object.has(scope, '$item')) {
      scope = scope.$item

      // 到这里 scope 可能为空
      // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

      // 取 this
      if (key === env.EMPTY_STRING) {
        return callback(keypath, scope)
      }
      // 取 this.xx
      if (scope && object.has(scope, key)) {
        return callback(keypath, scope[key])
      }
    }

    // 正常取数据
    const value = context.get(keypath, getKeypath)
    if (value === getKeypath) {
      if (lookup && index > 0) {
        index--
        return getKeypath(stack, index, key, lookup, callback, defaultKeypath)
      }
      if (defaultKeypath) {
        return callback(defaultKeypath, context.filter(key))
      }
    }
    else {
      return callback(keypath, value)
    }

  },

  renderValue = function (expr: ExpressionNode, simple?: boolean, stack?: any[]): any {
    const dataStack = stack || $stack
    return exprExecutor.execute(
      expr,
      function (key: string, node: Keypath): any {
        return getKeypath(
          dataStack,
          dataStack.length - 2 * (node.offset + 1),
          key,
          node.lookup,
          function (keypath: string, value: any) {
            node.absoluteKeypath = keypath
            return value
          }
        )
      },
      context
    )
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

  addBindingIfNeeded = function (vnode: any, attr: Record<string, any>): any {

    const result = getBindingValue(attr.expr)

    if (is.string(result.binding)) {
      const key = keypathUtil.join(config.DIRECTIVE_BINDING, attr.name),
      hooks = context.directive(config.DIRECTIVE_BINDING)
      if (hooks) {
        vnode.directives[key] = {
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

  spreadObject = function (vnode: any, attr: Record<string, any>) {

    let { expr } = attr,

    value = renderValue(expr, attr.binding)

    // 数组也算一种对象，要排除掉
    if (is.object(value) && !is.array(value)) {

      object.each(
        value,
        function (value: any, key: string) {
          vnode.props[key] = value
        }
      )

      const absoluteKeypath = expr[env.RAW_ABSOLUTE_KEYPATH]
      if (absoluteKeypath) {
        const key = keypathUtil.join(config.DIRECTIVE_BINDING, absoluteKeypath),
        hooks = context.directive(config.DIRECTIVE_BINDING)
        if (hooks) {
          vnode.directives[key] = {
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
  },

  parseDirective = function (vnode: any, attr: Record<string, any>) {

    let { name, modifier, value } = attr,

    key = keypathUtil.join(name, modifier),

    binding: string | void,

    hooks: DirectiveHooks | void,

    getter: signature.directiveGetter | void,

    handler: signature.directiveHandler | signature.eventListener | void,

    transition: TransitionHooks | void

    switch (name) {

      case config.DIRECTIVE_EVENT:
        hooks = context.directive(config.DIRECTIVE_EVENT)
        handler = attr.event
          ? createEventListener(attr.event)
          : createMethodListener(attr.method, attr.args, $stack)
        break

      case env.RAW_TRANSITION:
        transition = context.transition(value)
        if (transition) {
          vnode.transition = transition
        }
        else {
          logger.fatal(`transition [${value}] is not found.`)
        }
        return

      case config.DIRECTIVE_MODEL:
        hooks = context.directive(config.DIRECTIVE_MODEL)
        const result = getBindingValue(attr.expr)
        if (is.string(result.binding)) {
          binding = result.binding
          vnode.model = result.value
        }
        break

      case config.DIRECTIVE_LAZY:
        vnode.lazy[modifier] = value
        return

      default:
        hooks = context.directive(modifier)
        if (attr.method) {
          handler = createMethodListener(attr.method, attr.args, $stack)
        }
        else {
          getter = attr.getter
        }
        break

    }

    if (hooks) {
      vnode.directives[key] = {
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

  createEventListener = function (type: string): signature.eventListener {
    return function (event: Event, data?: Record<string, any>) {
      if (event.type !== type) {
        event = new Event(type, event)
      }
      context.fire(event, data)
    }
  },

  createMethodListener = function (method: string, args: Function | void, stack: any[]): signature.directiveHandler {
    return function (event?: Event, data?: Record<string, any>) {

      const callee = context[method]

      if (event instanceof Event) {

        let result: any | void

        if (args) {
          // 给当前 scope 加上 event 和 data
          eventScope = {
            $event: event,
            $data: data,
          }
          result = execute(callee, context, args(stack))
          // 阅后即焚
          eventScope = env.UNDEFINED
        }
        else {
          result = execute(callee, context, data ? [event, data] : event)
        }

        if (result === env.FALSE) {
          event.prevent().stop()
        }
      }
      else {
        args
          ? execute(callee, context, args(stack))
          : execute(callee, context)
      }

    }
  },

  renderExpression = function (expr: ExpressionNode, stringRequired: boolean | void): any {
    const value = renderValue(expr)
    return stringRequired
      ? toString(value)
      : value
  },

  renderExpressionArg = function (expr: ExpressionNode, stack: any[]): any {
    return renderValue(expr, env.UNDEFINED, stack)
  },

  renderExpressionText = function (expr: ExpressionNode, stringRequired: boolean | void) {
    renderPureText(
      renderExpression(expr, stringRequired)
    )
  },

  renderPureText = function (text: string) {
    if (vnodeList) {
      const lastVnode = array.last(vnodeList)
      if (lastVnode && lastVnode.isText) {
        lastVnode.text += text
      }
      else {
        array.push(
          vnodeList,
          {
            isText: env.TRUE,
            text,
            context,
            keypath: $keypath,
          }
        )
      }
    }
  },

  renderElement = function (vnode: Record<string, any>, attrs: any[] | Function | void, childs: Function | void) {

    let attributes: any[] | void, children = childs

    if (is.array(attrs)) {
      attributes = attrs as any[]
    }
    else if (is.func(attrs)) {
      children = attrs as Function
    }

    if (attributes) {

      vnode.props = {}
      vnode.nativeAttrs = {}
      vnode.nativeProps = {}
      vnode.directives = {}
      vnode.lazy = {}

      array.each(
        attributes,
        function (attr: any) {

          let { name, value } = attr

          switch (attr.type) {

            case nodeType.ATTRIBUTE:

              if (attr.binding) {
                value = addBindingIfNeeded(vnode, attr)
              }

              if (vnode.isComponent) {
                vnode.props[name] = value
              }
              else {
                vnode.nativeAttrs[name] = { name, value }
              }

              break

            case nodeType.PROPERTY:

              if (attr.binding) {
                value = addBindingIfNeeded(vnode, attr)
              }

              vnode.nativeProps[name] = {
                name,
                value,
                hint: attr.hint,
              }

              break

            case nodeType.DIRECTIVE:
              parseDirective(vnode, attr)
              break

            case nodeType.SPREAD:
              spreadObject(vnode, attr)
              break

          }
        }
      )

    }

    if (children) {
      vnodeList = vnode.children = []
      vnodeStack.push(vnodeList)
      children()
      array.pop(vnodeStack)
      vnodeList = array.last(vnodeStack)
    }

    vnode.context = context
    vnode.keypath = $keypath

    if (vnode.isComponent) {
      vnode.parent = context
    }

    if (vnodeList) {
      array.push(vnodeList, vnode)
    }

    return vnode

  },

  // <slot name="xx"/>
  renderSlot = function (name: string) {
    const render = context.get(config.SLOT_DATA_PREFIX + name)
    if (render) {
      render()
    }
  },

  // {{#partial name}}
  //   xx
  // {{/partial}}
  renderPartial = function (name: string, render: Function) {
    localPartials[name] = render
  },

  // {{> name}}
  renderImport = function (name: string) {
    if (localPartials[name]) {
      localPartials[name]()
      return
    }
    else {
      const partial = context.partial(name)
      if (partial) {
        partial(
          renderExpression,
          renderExpressionArg,
          renderExpressionText,
          renderPureText,
          renderElement,
          renderSlot,
          renderPartial,
          renderImport,
          renderEach
        )
        return
      }
    }
    logger.fatal(`partial "${name}" is not found.`)
  },

  renderEach = function (expr: ExpressionNode, index: string | Function | void, handler?: Function) {

    let eachIndex: string | void, eachHandler: Function

    if (is.func(index)) {
      eachHandler = index as Function
      eachIndex = env.UNDEFINED
    }
    else {
      eachHandler = handler as Function
      eachIndex = index as string
    }

    const value = renderValue(expr),

    exprKeypath = expr[env.RAW_ABSOLUTE_KEYPATH],

    eachKeypath = exprKeypath || keypathUtil.join($keypath, expr.raw),

    callback = function (item: any, key: string | number) {

      let lastKeypath = $keypath, lastScope = $scope, lastKeypathStack = $stack

      $keypath = keypathUtil.join(eachKeypath, key)
      $scope = {}
      $stack = object.copy($stack)

      array.push($stack, $keypath)
      array.push($stack, $scope)

      // 从下面这几句赋值可以看出
      // scope 至少会有 '$keypath' '$item' eachIndex 等几个值
      $scope.$keypath = $keypath

      // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
      // 因为通过 context.get() 无法获取数据
      if (!exprKeypath) {
        $scope.$item = item
      }

      if (eachIndex) {
        $scope[eachIndex] = key
      }

      eachHandler(item, key)

      $keypath = lastKeypath
      $scope = lastScope
      $stack = lastKeypathStack

    }

    if (is.array(value)) {
      array.each(value, callback)
    }
    else if (is.object(value)) {
      object.each(value, callback)
    }
    else if (is.func(value)) {
      value(callback)
    }

  }

  return result(
    renderExpression,
    renderExpressionArg,
    renderExpressionText,
    renderPureText,
    renderElement,
    renderSlot,
    renderPartial,
    renderImport,
    renderEach
  )
}