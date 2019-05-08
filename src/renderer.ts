import * as config from 'yox-config/src/config'
import * as type from 'yox-type/src/type'

import isDef from 'yox-common/src/function/isDef'
import isUndef from 'yox-common/src/function/isUndef'
import execute from 'yox-common/src/function/execute'
import toString from 'yox-common/src/function/toString'

import * as is from 'yox-common/src/util/is'
import * as env from 'yox-common/src/util/env'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as logger from 'yox-common/src/util/logger'
import * as keypathUtil from 'yox-common/src/util/keypath'

import CustomEvent from 'yox-common/src/util/CustomEvent'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Keypath from 'yox-expression-compiler/src/node/Keypath'

import * as exprExecutor from 'yox-expression-compiler/src/executor'

import Yox from 'yox-type/src/interface/Yox'
import VNode from 'yox-type/src/vnode/VNode'
import DirectiveHooks from 'yox-type/src/hooks/Directive'
import TransitionHooks from 'yox-type/src/hooks/Transition'

import * as nodeType from './nodeType'

function setPair(target: any, name: string, key: string, value: any) {
  const data = target[name] || (target[name] = {})
  data[key] = value
}

export function render(
  context: Yox,
  template: Function,
  filters: Record<string, Function>,
  partials: Record<string, Function>,
  directives: Record<string, DirectiveHooks>,
  transitions: Record<string, TransitionHooks>
) {

  let $keypath = env.EMPTY_STRING,

  $scope: type.data = { $keypath },

  $stack = [$keypath, $scope],

  $vnode: any,

  vnodeStack: VNode[][] = [],

  localPartials: Record<string, Function> = {},

  lookup = function (stack: any[], index: number, key: string, node: Keypath, depIgnore?: boolean, defaultKeypath?: string) {

    let keypath = keypathUtil.join(stack[index], key),

    scope = stack[index + 1]

    node.ak = keypath

    // 如果最后还是取不到值，用回最初的 keypath
    if (isUndef(defaultKeypath)) {
      defaultKeypath = keypath
    }

    // 如果取的是 scope 上直接有的数据，如 $keypath
    if (isDef(scope[key])) {
      return scope[key]
    }

    // 如果取的是数组项，则要更进一步
    if (isDef(scope.$item)) {
      scope = scope.$item

      // 到这里 scope 可能为空
      // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

      // 取 this
      if (key === env.EMPTY_STRING) {
        return scope
      }
      // 取 this.xx
      if (scope != env.NULL && isDef(scope[key])) {
        return scope[key]
      }
    }

    // 正常取数据
    const result = context.get(keypath, lookup, depIgnore)
    if (result === lookup) {
      // undefined 或 true 都表示需要向上寻找
      if (node.lookup !== env.FALSE && index > 1) {
        index -= 2
        if (process.env.NODE_ENV === 'dev') {
          logger.warn(`Can't find [${keypath}], start looking up.`)
        }
        return lookup(stack, index, key, node, depIgnore, defaultKeypath)
      }
      const holder = object.get(filters, key)
      return holder
        ? holder.value
        : (node.ak = defaultKeypath, env.UNDEFINED)
    }

    return result

  },

  getValue = function (expr: ExpressionNode, depIgnore?: boolean, stack?: any[]): any {

    const renderStack = stack || $stack,

    { length } = renderStack

    return exprExecutor.execute(
      expr,
      function (keypath: string, node: Keypath): any {
        return lookup(
          renderStack,
          length - 2 * ((node.offset || 0) + 1),
          keypath,
          node,
          depIgnore
        )
      },
      context
    )

  },

  addBinding = function (vnode: type.data, name: string, expr: Keypath, hint?: type.hint): any {

    const value = getValue(expr, env.TRUE),

    key = keypathUtil.join(config.DIRECTIVE_BINDING, name)

    setPair(
      vnode,
      'directives',
      key,
      {
        ns: config.DIRECTIVE_BINDING,
        name,
        key,
        hooks: directives[config.DIRECTIVE_BINDING],
        binding: expr.ak,
        hint,
      }
    )

    return value

  },

  createEventListener = function (type: string): type.listener {
    return function (event: CustomEvent, data?: type.data) {
      // 事件名称相同的情况，只可能是监听 DOM 事件，比如写一个 Button 组件
      // <button on-click="click"> 纯粹的封装了一个原生 click 事件
      if (type !== event.type) {
        event = new CustomEvent(type, event)
      }
      context.fire(event, data)
    }
  },

  createMethodListener = function (
    name: string,
    args: Function | void,
    stack: any[]
  ): type.listener {
    return function (event: CustomEvent, data?: type.data) {

      const method = context[name]

      if (event instanceof CustomEvent) {

        let result: any | void

        if (args) {
          const scope = array.last(stack)
          if (scope) {
            scope.$event = event
            scope.$data = data
            result = execute(method, context, args(stack))
            scope.$event =
            scope.$data = env.UNDEFINED
          }
        }
        else {
          result = execute(method, context, data ? [event, data] : event)
        }

        return result

      }
      else {
        execute(
          method,
          context,
          args ? args(stack) : env.UNDEFINED
        )
      }

    }
  },

  createGetter = function (getter: Function, stack: any[]): type.getter {
    return function () {
      return getter(stack)
    }
  },

  renderExpression = function (expr: ExpressionNode, stringRequired: boolean | void): any {
    const value = getValue(expr)
    return stringRequired
      ? toString(value)
      : value
  },

  renderExpressionArg = function (expr: ExpressionNode, stack: any[]): any {
    return getValue(expr, env.UNDEFINED, stack)
  },

  renderExpressionVnode = function (expr: ExpressionNode, stringRequired: boolean) {
    renderTextVnode(
      renderExpression(expr, stringRequired)
    )
  },

  renderTextVnode = function (text: string) {
    const vnodeList = array.last(vnodeStack)
    if (vnodeList) {
      const lastVnode = array.last(vnodeList)
      if (lastVnode && lastVnode.isText) {
        (lastVnode.text as string) += text
      }
      else {
        const textVnode: any = {
          isText: env.TRUE,
          text,
          context,
          keypath: $keypath,
        }
        array.push(vnodeList, textVnode)
      }
    }
  },

  renderAttributeVnode = function (name: string, binding: boolean | void, expr: Keypath | void, value: string | void) {
    if (binding) {
      value = addBinding($vnode, name, expr as Keypath)
    }
    if ($vnode.isComponent) {
      setPair($vnode, 'props', name, value)
    }
    else {
      setPair($vnode, 'nativeAttrs', name, { name, value })
    }
  },

  renderPropertyVnode = function (name: string, hint: type.hint, binding: boolean | void, expr: Keypath | void, value: any | void) {
    if (binding) {
      value = addBinding($vnode, name, expr as Keypath, hint)
    }
    setPair($vnode, 'nativeProps', name, { name, value, hint })
  },

  renderLazyVnode = function (name: string, value: type.lazy) {
    setPair($vnode, 'lazy', name, value)
  },

  renderTransitionVnode = function (name: string) {
    $vnode.transition = transitions[name]
    if (process.env.NODE_ENV === 'dev') {
      if (!$vnode.transition) {
        logger.fatal(`transition [${name}] is not found.`)
      }
    }
  },

  renderModelVnode = function (expr: Keypath) {

    $vnode.model = getValue(expr, env.TRUE)

    setPair(
      $vnode,
      'directives',
      config.DIRECTIVE_MODEL,
      {
        ns: config.DIRECTIVE_MODEL,
        name: env.EMPTY_STRING,
        key: config.DIRECTIVE_MODEL,
        binding: expr.ak,
        hooks: directives[config.DIRECTIVE_MODEL]
      }
    )
  },

  renderEventMethodVnode = function (
    ns: string, name: string, key: string, value: string,
    method: string, args: Function | void
  ) {
    setPair(
      $vnode,
      'directives',
      key,
      {
        ns,
        name,
        key,
        value,
        hooks: directives[config.DIRECTIVE_EVENT],
        handler: createMethodListener(method as string, args, $stack)
      }
    )
  },

  renderEventNameVnode = function (
    ns: string, name: string, key: string, value: string,
    event: string
  ) {
    setPair(
      $vnode,
      'directives',
      key,
      {
        ns,
        name,
        key,
        value,
        hooks: directives[config.DIRECTIVE_EVENT],
        handler: createEventListener(event)
      }
    )
  },

  renderDirectiveVnode = function (
    ns: string, name: string, key: string, value: string,
    method: string | void, args: Function | void, getter: Function | void
  ) {

    const hooks = directives[name]

    if (process.env.NODE_ENV === 'dev') {
      if (!hooks) {
        logger.fatal(`directive [${name}] is not found.`)
      }
    }

    setPair(
      $vnode,
      'directives',
      key,
      {
        ns,
        name,
        key,
        value,
        hooks,
        getter: getter ? createGetter(getter, $stack) : env.UNDEFINED,
        handler: method ? createMethodListener(method, args, $stack) : env.UNDEFINED,
      }
    )

  },

  renderSpreadVnode = function (expr: ExpressionNode, binding?: boolean) {

    const value = getValue(expr, binding)

    // 数组也算一种对象，要排除掉
    if (is.object(value) && !is.array(value)) {

      object.each(
        value,
        function (value: any, key: string) {
          setPair($vnode, 'props', key, value)
        }
      )

      const absoluteKeypath = expr['ak']
      if (absoluteKeypath) {
        const key = keypathUtil.join(config.DIRECTIVE_BINDING, absoluteKeypath)
        setPair(
          $vnode,
          'directives',
          key,
          {
            ns: config.DIRECTIVE_BINDING,
            name: env.EMPTY_STRING,
            key,
            hooks: directives[config.DIRECTIVE_BINDING],
            binding: keypathUtil.join(absoluteKeypath, env.RAW_WILDCARD),
          }
        )
      }

    }
    else if (process.env.NODE_ENV === 'dev') {
      logger.warn(`[${expr.raw}] 不是对象，延展个毛啊`)
    }

  },

  renderElementVnode = function (
    vnode: type.data,
    attrs: Function | void,
    childs: Function | void,
    slots: Record<string, Function> | void
  ) {

    if (attrs) {
      $vnode = vnode
      attrs()
      $vnode = env.UNDEFINED
    }

    // childs 和 slots 不可能同时存在
    if (childs) {
      vnodeStack.push(vnode.children = [])
      childs()
      array.pop(vnodeStack)
    }
    else if (slots) {
      const renderSlots = {}
      object.each(
        slots,
        function (slot: Function, name: string) {
          vnodeStack.push([])
          slot()
          renderSlots[name] = array.pop(vnodeStack)
        }
      )
      vnode.slots = renderSlots
    }

    vnode.context = context
    vnode.keypath = $keypath

    const vnodeList = array.last(vnodeStack)
    if (vnodeList) {
      array.push(vnodeList, vnode)
    }

    return vnode

  },

  // <slot name="xx"/>
  renderSlot = function (name: string, defaultRender?: Function) {

    const vnodeList = array.last(vnodeStack),

    vnodes = context.get(name)

    if (vnodeList) {
      if (vnodes) {
        array.each(
          vnodes,
          function (vnode: VNode) {
            array.push(vnodeList, vnode)
            vnode.parent = context
          }
        )
      }
      else if (defaultRender) {
        defaultRender()
      }
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
    }
    else {
      const partial = partials[name]
      if (partial) {
        partial(
          renderExpression,
          renderExpressionArg,
          renderExpressionVnode,
          renderTextVnode,
          renderAttributeVnode,
          renderPropertyVnode,
          renderLazyVnode,
          renderTransitionVnode,
          renderModelVnode,
          renderEventMethodVnode,
          renderEventNameVnode,
          renderDirectiveVnode,
          renderSpreadVnode,
          renderElementVnode,
          renderSlot,
          renderPartial,
          renderImport,
          renderEach
        )
      }
      else if (process.env.NODE_ENV === 'dev') {
        logger.fatal(`partial [${name}] is not found.`)
      }
    }
  },

  renderEach = function (handler: Function, expr: ExpressionNode, index: string | void) {

    const value = getValue(expr),

    exprKeypath = expr['ak'],

    eachKeypath = exprKeypath || keypathUtil.join($keypath, expr.raw),

    callback = function (item: any, key: string | number, length?: number) {

      let lastKeypath = $keypath, lastScope = $scope, lastKeypathStack = $stack

      $keypath = keypathUtil.join(eachKeypath, toString(key))
      $scope = {}
      $stack = object.copy($stack)

      array.push($stack, $keypath)
      array.push($stack, $scope)

      // 从下面这几句赋值可以看出
      // scope 至少会有 '$keypath' '$length' '$item' index 等几个值
      $scope.$keypath = $keypath

      // 避免模板里频繁读取 list.length
      $scope.$length = length

      // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
      // 因为通过 context.get() 无法获取数据
      if (!exprKeypath) {
        $scope.$item = item
      }

      if (index) {
        $scope[index] = key
      }

      handler()

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

  return template(
    renderExpression,
    renderExpressionArg,
    renderExpressionVnode,
    renderTextVnode,
    renderAttributeVnode,
    renderPropertyVnode,
    renderLazyVnode,
    renderTransitionVnode,
    renderModelVnode,
    renderEventMethodVnode,
    renderEventNameVnode,
    renderDirectiveVnode,
    renderSpreadVnode,
    renderElementVnode,
    renderSlot,
    renderPartial,
    renderImport,
    renderEach
  )

}