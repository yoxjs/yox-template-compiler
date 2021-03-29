import {
  DIRECTIVE_CUSTOM,
} from 'yox-config/src/config'

import {
  Data,
  Listener,
  LazyValue,
  ValueHolder,
} from 'yox-type/src/type'

import {
  DirectiveHooks,
  TransitionHooks,
} from 'yox-type/src/hooks'

import {
  EventRuntime,
  DirectiveRuntime,
} from 'yox-type/src/vnode'

import {
  YoxInterface,
} from 'yox-type/src/yox'

import isDef from 'yox-common/src/function/isDef'
import execute from 'yox-common/src/function/execute'
import toString from 'yox-common/src/function/toString'
import CustomEvent from 'yox-common/src/util/CustomEvent'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as logger from 'yox-common/src/util/logger'
import * as constant from 'yox-common/src/util/constant'
import * as keypathUtil from 'yox-common/src/util/keypath'

import globalHolder from 'yox-common/src/util/holder'

import Observer from 'yox-observer/src/Observer'

import * as field from './field'

export function render(
  context: YoxInterface,
  observer: Observer,
  template: Function,
  filters: Record<string, Function>,
  partials: Record<string, Function>,
  directives: Record<string, DirectiveHooks>,
  transitions: Record<string, TransitionHooks>
) {

  let currentKeypath = constant.EMPTY_STRING,

  keypathStack = [ currentKeypath ],

  localPartials: Record<string, Function> = { },

  findValue = function (stack: string[], index: number, key: string, lookup: boolean, call: boolean, defaultKeypath?: string): ValueHolder {

    let baseKeypath = stack[index],

    keypath = keypathUtil.join(baseKeypath, key),

    value: any = constant.UNDEFINED

    // 如果最后还是取不到值，用回最初的 keypath
    if (defaultKeypath === constant.UNDEFINED) {
      defaultKeypath = keypath
    }

    // 正常取数据
    value = observer.get(keypath, stack)
    if (value === stack) {

      if (lookup && index > 0) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug(`The data "${keypath}" can't be found in the current context, start looking up.`)
        }
        return findValue(stack, index - 1, key, lookup, call, defaultKeypath)
      }

      // 到头了，如果是函数调用，则最后尝试过滤器
      if (call) {
        const result = object.get(filters, key)
        if (result) {
          result.keypath = key
          return result
        }
      }

      globalHolder.value = constant.UNDEFINED
      globalHolder.keypath = defaultKeypath

    }
    else {
      globalHolder.value = value
      globalHolder.keypath = keypath
    }

    return globalHolder

  },

  flattenArray = function (array: any[], handler: (item: any) => void) {
    for (let i = 0, length = array.length; i < length; i++) {
      const item = array[i]
      if (is.array(item)) {
        flattenArray(item, handler)
      }
      else if (isDef(item)) {
        handler(item)
      }
    }
  },

  normalizeAttributes = function (attrs: any[], data: Data) {
    flattenArray(
      attrs,
      function (item) {
        const { key, name, value } = item
        if (data[key]) {
          data[key][name] = value
        }
        else {
          if (name) {
            const map = {}
            map[name] = value
            data[key] = map
          }
          else {
            data[key] = value
          }
        }
      }
    )
  },

  normalizeChildren = function (children: any[], vnodes: any[], components?: any[]) {
    flattenArray(
      children,
      function (item) {
        // item 只能是 vnode
        if (item.isText) {
          const lastChild = array.last(vnodes)
          if (lastChild && lastChild.isText) {
            lastChild.text += item.text
            return
          }
        }
        else if (item.isComponent && components) {
          components.push(item)
        }
        vnodes.push(item)
      }
    )
  },

  renderElementVnode = function (
    data: Data,
    attrs: any[] | void,
    childs: any[] | void
  ) {

    data.context = context

    if (attrs) {
      normalizeAttributes(attrs, data)
    }

    if (childs) {
      const children: any[] = [ ]
      normalizeChildren(childs, children)
      data.children = children
    }

    return data

  },

  renderComponentVnode = function (
    data: Data,
    attrs: any[] | void,
    slots: Data | void
  ) {

    data.context = context

    if (attrs) {
      normalizeAttributes(attrs, data)
    }

    if (slots) {
      const result = { }
      for (let name in slots) {
        const vnodes: any[] = [ ], components: any[] = [ ]
        normalizeChildren(slots[name], vnodes, components)
        // 就算是 undefined 也必须有值，用于覆盖旧值
        result[name] = vnodes.length
          ? {
              vnodes,
              components: components.length
                ? components
                : constant.UNDEFINED
            }
          : constant.UNDEFINED
      }
      data.slots = result
    }

    return data

  },

  renderNativeAttribute = function (name: string, value: string | void) {
    return {
      key: field.NATIVE_ATTRIBUTES,
      name,
      value,
    }
  },

  renderNativeProperty = function (name: string, value: any) {
    return {
      key: field.NATIVE_PROPERTIES,
      name,
      value,
    }
  },

  renderProperty = function (name: string, value: string | void) {
    return {
      key: field.PROPERTIES,
      name,
      value,
    }
  },

  renderLazy = function (name: string, value: LazyValue) {
    return {
      key: field.LAZY,
      name,
      value,
    }
  },

  renderTransition = function (name: string) {
    return {
      key: field.TRANSITION,
      value: getTransition(name),
    }
  },

  getTransition = function (name: string) {
    const transition = transitions[name]
    if (process.env.NODE_ENV === 'development') {
      if (!transition) {
        logger.fatal(`The transition "${name}" can't be found.`)
      }
    }
    return transition
  },

  renderModel = function (holder: ValueHolder) {
    return {
      key: field.MODEL,
      value: getModel(holder),
    }
  },

  getModel = function (holder: ValueHolder) {
    return {
      value: holder.value,
      keypath: holder.keypath,
    }
  },

  createEventNameListener = function (isComponent: boolean, type: string, ns?: string): Listener {
    return function (event: CustomEvent, data?: Data, isNative?: boolean) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      if (type !== event.type || ns !== event.ns) {
        event = new CustomEvent(
          type,
          isNative
            ? event.originalEvent
            : event
        )
        event.ns = ns
      }
      context.fire(event, data)

    }
  },

  createEventMethodListener = function (isComponent: boolean, name: string, runtime: EventRuntime | void): Listener {
    return function (event: CustomEvent, data?: Data) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      let methodArgs: any

      if (runtime) {
        methodArgs = runtime.args(runtime.stack, event, data)
        // 1 个或 0 个参数可优化调用方式，即 method.call 或直接调用函数
        if (methodArgs.length < 2) {
          methodArgs = methodArgs[0]
        }
      }
      else {
        methodArgs = data ? [event, data] : event
      }

      const result = execute(
        context[name],
        context,
        methodArgs
      )

      if (result === constant.FALSE) {
        event.prevent().stop()
      }

    }
  },

  renderEventMethod = function (params: Data) {
    return {
      key: field.EVENTS,
      name: params.key,
      value: getEventMethod(params),
    }
  },

  getEventMethod = function (params: Data) {
    const { runtime } = params
    if (runtime) {
      runtime.stack = keypathStack
    }
    return {
      key: params.key,
      value: params.value,
      name: params.from,
      ns: params.fromNs,
      isNative: params.isNative,
      listener: createEventMethodListener(params.isComponent, params.method, runtime),
      runtime,
    }
  },

  renderEventName = function (params: Data) {
    return {
      key: field.EVENTS,
      name: params.key,
      value: getEventName(params),
    }
  },

  getEventName = function (params: Data) {
    return {
      key: params.key,
      value: params.value,
      name: params.from,
      ns: params.fromNs,
      isNative: params.isNative,
      listener: createEventNameListener(params.isComponent, params.to, params.toNs),
    }
  },

  createDirectiveGetter = function (runtime: DirectiveRuntime): () => any {
    return function () {
      return (runtime.expr as Function)(runtime.stack)
    }
  },

  createDirectiveHandler = function (name: string, runtime: DirectiveRuntime | void) {
    return function () {

      let methodArgs: any = constant.UNDEFINED

      if (runtime) {
        methodArgs = (runtime.args as Function)(runtime.stack)
        // 1 个或 0 个参数可优化调用方式，即 method.call 或直接调用函数
        if (methodArgs.length < 2) {
          methodArgs = methodArgs[0]
        }
      }

      execute(
        context[name],
        context,
        methodArgs
      )
    }
  },

  renderDirective = function (params: Data) {
    return {
      key: field.DIRECTIVES,
      name: params.key,
      value: getDirective(params),
    }
  },

  getDirective = function (params: Data) {

    const { name, runtime } = params, hooks = directives[name]
    if (runtime) {
      runtime.stack = keypathStack
    }

    if (process.env.NODE_ENV === 'development') {
      if (!hooks) {
        logger.fatal(`The directive "${name}" can't be found.`)
      }
    }

    return {
      ns: DIRECTIVE_CUSTOM,
      key: params.key,
      name,
      value: params.value,
      modifier: params.modifier,
      getter: runtime && runtime.expr ? createDirectiveGetter(runtime) : constant.UNDEFINED,
      handler: params.method ? createDirectiveHandler(params.method, runtime) : constant.UNDEFINED,
      hooks,
      runtime,
    }

  },

  renderSpread = function (value: any) {

    if (is.object(value)) {

      // 数组也算一种对象
      // 延展操作符不支持数组
      if (process.env.NODE_ENV === 'development') {
        if (is.array(value)) {
          logger.fatal(`The spread operator can't be used by an array.`)
        }
      }

      const result: any[] = []

      for (let key in value) {
        result.push({
          key: field.PROPERTIES,
          name: key,
          value: value[key],
        })
      }

      return result

    }

  },

  renderTextVnode = function (value: string) {
    return {
      isText: constant.TRUE,
      text: value,
      context,
    }
  },

  renderCommentVnode = function () {
    return {
      isComment: constant.TRUE,
      text: constant.EMPTY_STRING,
      context,
    }
  },

  // <slot name="xx"/>
  renderSlot = function (name: string, render?: Function) {
    const result = context.get(name)
    if (result) {
      const { vnodes, components } = result
      if (components) {
        for (let i = 0, length = components.length; i < length; i++) {
          components[i].parent = context
        }
      }
      return vnodes
    }
    return render && render()
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
      return localPartials[name]()
    }
    const partial = partials[name]
    if (process.env.NODE_ENV === 'development') {
      if (!partial) {
        logger.fatal(`The partial "${name}" can't be found.`)
      }
    }
    return renderTemplate(partial)
  },

  renderEach = function (
    holder: ValueHolder,
    renderChildren: Function,
    renderElse?: Function
  ) {

    let { keypath, value } = holder, result: any[] = [ ],

    needKeypath = !!keypath, oldKeypathStack = keypathStack, oldCurrentKeypath = currentKeypath

    if (is.array(value)) {
      for (let i = 0, length = value.length; i < length; i++) {
        if (needKeypath) {
          currentKeypath = keypath + constant.RAW_DOT + i
          // slice + push 比直接 concat 快多了
          keypathStack = oldKeypathStack.slice()
          keypathStack.push(currentKeypath)
        }
        result.push(
          renderChildren(
            currentKeypath || constant.EMPTY_STRING,
            length,
            value[i],
            i
          )
        )
      }
    }
    else if (is.object(value)) {
      for (let key in value) {
        if (needKeypath) {
          // 这里 key 虽然可能为空，但也必须直接拼接
          // 因为不拼接就变成了原来的 keypath，这样更是错的，
          // 只能在使用上尽量避免 key 为空的用法
          currentKeypath = keypath + constant.RAW_DOT + key
          // slice + push 比直接 concat 快多了
          keypathStack = oldKeypathStack.slice()
          keypathStack.push(currentKeypath)
        }
        result.push(
          renderChildren(
            currentKeypath || constant.EMPTY_STRING,
            constant.UNDEFINED,
            value[key],
            key
          )
        )
      }
    }

    if (keypathStack !== oldKeypathStack) {
      currentKeypath = oldCurrentKeypath
      keypathStack = oldKeypathStack
    }

    if (renderElse && result.length === 0) {
      result = renderElse()
    }

    return result

  },

  renderRange = function (
    from: number,
    to: number,
    equal: boolean,
    renderChildren: Function,
    renderElse?: Function
  ) {

    let count = 0, length = 0, result: any[] = []

    if (from < to) {
      length = to - from
      if (equal) {
        for (let i = from; i <= to; i++) {
          result.push(
            renderChildren(
              currentKeypath,
              length,
              i,
              count++
            )
          )
        }
      }
      else {
        for (let i = from; i < to; i++) {
          result.push(
            renderChildren(
              currentKeypath,
              length,
              i,
              count++
            )
          )
        }
      }
    }
    else {
      length = from - to
      if (equal) {
        for (let i = from; i >= to; i--) {
          result.push(
            renderChildren(
              currentKeypath,
              length,
              i,
              count++
            )
          )
        }
      }
      else {
        for (let i = from; i > to; i--) {
          result.push(
            renderChildren(
              currentKeypath,
              length,
              i,
              count++
            )
          )
        }
      }
    }

    if (renderElse && length === 0) {
      result = renderElse()
    }

    return result

  },

  renderExpressionIdentifier = function (params: Data) {

    const stack = params.stack || keypathStack,

    index = stack.length - 1,

    result = findValue(
      stack,
      params.root ? 0 : (params.offset ? index - params.offset : index),
      params.name,
      params.lookup,
      params.call
    )

    return params.holder ? result : result.value

  },

  renderExpressionMemberLiteral = function (
    value: any,
    keypath: string,
    holder: boolean | void
  ) {
    const match = object.get(value, keypath)
    globalHolder.keypath = constant.UNDEFINED
    globalHolder.value = match ? match.value : constant.UNDEFINED
    return holder ? globalHolder : globalHolder.value
  },

  renderExpressionCall = function (
    fn: Function | void,
    args: any[] | void,
    holder: boolean | void
  ) {
    globalHolder.keypath = constant.UNDEFINED
    globalHolder.value = execute(fn, context, args)
    return holder ? globalHolder : globalHolder.value
  },

  renderTemplate = function (render: Function) {
    return render(
      renderElementVnode,
      renderComponentVnode,
      renderNativeAttribute,
      renderNativeProperty,
      renderProperty,
      renderLazy,
      renderTransition,
      getTransition,
      renderModel,
      getModel,
      renderEventMethod,
      getEventMethod,
      renderEventName,
      getEventName,
      renderDirective,
      getDirective,
      renderSpread,
      renderTextVnode,
      renderCommentVnode,
      renderSlot,
      renderPartial,
      renderImport,
      renderEach,
      renderRange,
      renderExpressionIdentifier,
      renderExpressionMemberLiteral,
      renderExpressionCall,
      currentKeypath,
      toString
    )
  }

  const result = renderTemplate(template)

  if (process.env.NODE_ENV === 'development') {
    if (is.array(result)) {
      logger.fatal(`The template should have just one root element.`)
    }
  }

  return result

}