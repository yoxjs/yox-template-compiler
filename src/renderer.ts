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

import * as field from './field'

type Context = {
  keypath: string,
  scope: any,
}

export function render(
  instance: YoxInterface,
  template: Function,
  scope: Record<string, any>,
  filters: Record<string, Function>,
  partials: Record<string, Function>,
  directives: Record<string, DirectiveHooks>,
  transitions: Record<string, TransitionHooks>
) {

  let rootKeypath = constant.EMPTY_STRING,

  contextStack: Context[] = [
    { keypath: rootKeypath, scope, }
  ],

  localPartials: Record<string, Function> = { },

  // 渲染模板的数据依赖
  dependencies: Record<string, boolean> = { },

  lookupValue = function (stack: Context[], index: number, key: string): ValueHolder | undefined {

    const context = stack[index],

    keypath = keypathUtil.join(context.keypath, key),

    result = object.get(context.scope, keypath)

    if (result) {
      result.keypath = keypath
      return result
    }

    if (index > 0) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`The data "${keypath}" can't be found in the current context, start looking up.`)
      }
      return lookupValue(stack, index - 1, key)
    }

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
            const map = { }
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

  normalizeChildren = function (children: any[], vnodes: any[]) {
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
        vnodes.push(item)
      }
    )
  },

  renderElementVnode = function (
    data: Data,
    attrs: any[] | void,
    childs: any[] | void
  ) {

    data.context = instance

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
    slots: Data | void,
    components: any[] | void,
  ) {

    data.context = instance

    if (attrs) {
      normalizeAttributes(attrs, data)
    }

    if (slots) {
      const result = { }
      for (let name in slots) {
        const vnodes: any[] = [ ], slotComponents: any[] = [ ]
        normalizeChildren(slots[name](slotComponents), vnodes)
        // 就算是 undefined 也必须有值，用于覆盖旧值
        result[name] = vnodes.length
          ? {
              vnodes,
              components: slotComponents.length
                ? slotComponents
                : constant.UNDEFINED
            }
          : constant.UNDEFINED

      }
      data.slots = result
    }

    if (components) {
      components.push(data)
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
      instance.fire(event, data)

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
        instance[name],
        instance,
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
      runtime.stack = contextStack
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
        instance[name],
        instance,
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
      runtime.stack = contextStack
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
      context: instance,
    }
  },

  renderCommentVnode = function () {
    return {
      isComment: constant.TRUE,
      text: constant.EMPTY_STRING,
      context: instance,
    }
  },

  // <slot name="xx"/>
  renderSlot = function (name: string, render?: Function) {
    dependencies[name] = constant.TRUE
    const result = scope[name]
    if (result) {
      const { vnodes, components } = result
      if (components) {
        for (let i = 0, length = components.length; i < length; i++) {
          components[i].parent = instance
        }
      }
      return vnodes
    }
    return render && render()
  },

  // {{#partial name}}
  //   xx
  // {{/partial}}
  definePartial = function (name: string, render: Function) {
    localPartials[name] = render
  },

  // {{> name}}
  renderPartial = function (name: string, keypath: string) {
    if (localPartials[name]) {
      return localPartials[name](keypath)
    }
    const partial = partials[name]
    if (process.env.NODE_ENV === 'development') {
      if (!partial) {
        logger.fatal(`The partial "${name}" can't be found.`)
      }
    }
    return renderTemplate(partial, keypath)
  },

  renderEach = function (
    holder: ValueHolder,
    renderChildren: Function,
    renderElse?: Function
  ) {

    let { keypath, value } = holder, result: any[] = [ ],

    needKeypath = !!keypath, oldScopeStack = contextStack, currentKeypath = (array.last(contextStack) as Context).keypath

    if (is.array(value)) {
      for (let i = 0, length = value.length; i < length; i++) {
        if (needKeypath) {
          currentKeypath = keypath + constant.RAW_DOT + i
          // slice + push 比直接 concat 快多了
          contextStack = oldScopeStack.slice()
          contextStack.push({
            keypath: currentKeypath,
            scope: value[i],
          })
        }
        result.push(
          renderChildren(
            currentKeypath,
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
          contextStack = oldScopeStack.slice()
          contextStack.push({
            keypath: currentKeypath,
            scope: value[key],
          })
        }
        result.push(
          renderChildren(
            currentKeypath,
            constant.UNDEFINED,
            value[key],
            key
          )
        )
      }
    }

    if (contextStack !== oldScopeStack) {
      contextStack = oldScopeStack
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

    let count = 0, length = 0, result: any[] = [], currentKeypath = (array.last(contextStack) as Context).keypath

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

  renderExpressionIdentifier = function (
    getIndex: (stack: Context[]) => number, tokens?: string[],
    lookup?: boolean, stack?: Context[], call?: boolean
  ) {

    const currentStack = stack || contextStack,

    index = getIndex(currentStack),

    { keypath, scope } = currentStack[index],

    name = tokens ? tokens.join(constant.RAW_DOT) : constant.EMPTY_STRING,

    currentKeypath = keypathUtil.join(keypath, name)


    let result: ValueHolder | void
    if (tokens) {
      result = object.get(scope, tokens)
    }
    else {
      result = globalHolder
      result.value = scope
    }

    if (result) {
      result.keypath = currentKeypath
    }
    else {
      if (lookup && index > 0) {
        result = lookupValue(currentStack, index - 1, name)
      }
      // 如果是函数调用，则最后尝试过滤器
      if (!result && call) {
        result = object.get(filters, name)
        if (result) {
          // filter 不算数据
          result.keypath = constant.UNDEFINED
        }
      }
      if (!result) {
        result = globalHolder
        result.keypath = currentKeypath
        result.value = constant.UNDEFINED
      }
    }

    if (result.keypath !== constant.UNDEFINED) {
      dependencies[result.keypath] = constant.TRUE
    }

    return result

  },

  renderExpressionValue = function (
    value: any,
    tokens: string[]
  ) {
    const result = object.get(value, tokens)
    if (result) {
      result.keypath = constant.UNDEFINED
      return result
    }
    globalHolder.keypath =
    globalHolder.value = constant.UNDEFINED
    return globalHolder
  },

  executeFunction = function (
    fn: Function | void,
    args: any[] | void
  ) {
    globalHolder.keypath = constant.UNDEFINED
    globalHolder.value = execute(fn, instance, args)
    return globalHolder
  },

  renderTemplate = function (render: Function, keypath: string) {
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
      definePartial,
      renderPartial,
      renderEach,
      renderRange,
      renderExpressionIdentifier,
      renderExpressionValue,
      executeFunction,
      toString,
      keypath,
    )
  }

  const vnode = renderTemplate(template, rootKeypath)

  if (process.env.NODE_ENV === 'development') {
    if (is.array(vnode)) {
      logger.fatal(`The template should have just one root element.`)
    }
  }

  return {
    vnode,
    dependencies,
  }

}