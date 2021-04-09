import {
  DIRECTIVE_CUSTOM,
} from 'yox-config/src/config'

import {
  Data,
  Filter,
  Listener,
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

type Context = {
  keypath: string,
  scope: any,
}

export function render(
  instance: YoxInterface,
  template: Function,
  scope: Record<string, any>,
  filters: Record<string, Filter> | undefined,
  globalFilters: Record<string, Filter>,
  partials: Record<string, Function> | undefined,
  globalPartials: Record<string, Function>,
  directives: Record<string, DirectiveHooks> | undefined,
  globalDirectives: Record<string, DirectiveHooks>,
  transitions: Record<string, TransitionHooks> | undefined,
  globalTransitions: Record<string, TransitionHooks>,
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

  renderTransition = function (name: string) {
    const transition = (transitions && transitions[name]) || globalTransitions[name]
    if (process.env.NODE_ENV === 'development') {
      if (!transition) {
        logger.fatal(`The transition "${name}" can't be found.`)
      }
    }
    return transition
  },

  // holder 是全局共用的，这里要浅拷贝一次
  renderModel = function (holder: ValueHolder) {
    return {
      keypath: holder.keypath,
      value: holder.value,
    }
  },

  createEventNameListener = function (isComponent: boolean | void, type: string, ns?: string): Listener {
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

  createEventMethodListener = function (isComponent: boolean | void, name: string, runtime: EventRuntime | void): Listener {
    return function (event: CustomEvent, data?: Data) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      const result = execute(
        instance[name],
        instance,
        runtime
          ? runtime.args(runtime.stack, event, data)
          : (data ? [event, data] : event)
      )

      if (result === constant.FALSE) {
        event.prevent().stop()
      }

    }
  },

  renderEventMethod = function (key: string, value: string, name: string, ns: string, method: string, runtime?: EventRuntime, isComponent?: boolean, isNative?: boolean) {
    if (runtime) {
      runtime.stack = contextStack
    }
    return {
      key,
      value,
      name,
      ns,
      isNative,
      listener: createEventMethodListener(isComponent, method, runtime),
      runtime,
    }
  },

  renderEventName = function (key: string, value: string, name: string, ns: string, to: string, toNs?: string, isComponent?: boolean, isNative?: boolean) {
    return {
      key,
      value,
      name,
      ns,
      isNative,
      listener: createEventNameListener(isComponent, to, toNs),
    }
  },

  createDirectiveGetter = function (runtime: DirectiveRuntime): () => any {
    return function () {
      return (runtime.expr as Function)(runtime.stack)
    }
  },

  createDirectiveHandler = function (name: string, runtime: DirectiveRuntime | void) {
    return function () {
      execute(
        instance[name],
        instance,
        runtime
          ? (runtime.args as Function)(runtime.stack)
          : constant.UNDEFINED
      )
    }
  },

  renderDirective = function (key: string, name: string, modifier: string, value: any, runtime?: DirectiveRuntime, method?: string) {

    const hooks = (directives && directives[name]) || globalDirectives[name]
    if (process.env.NODE_ENV === 'development') {
      if (!hooks) {
        logger.fatal(`The directive "${name}" can't be found.`)
      }
    }

    if (runtime) {
      runtime.stack = contextStack
    }

    return {
      ns: DIRECTIVE_CUSTOM,
      key,
      name,
      value,
      modifier,
      getter: runtime && runtime.expr ? createDirectiveGetter(runtime) : constant.UNDEFINED,
      handler: method ? createDirectiveHandler(method, runtime) : constant.UNDEFINED,
      hooks,
      runtime,
    }

  },

  renderSpread = function (key: string, value: any) {

    if (is.object(value)) {

      // 数组也算一种对象
      // 延展操作符不支持数组
      if (process.env.NODE_ENV === 'development') {
        if (is.array(value)) {
          logger.fatal(`The spread operator can't be used by an array.`)
        }
      }

      const result: any[] = []

      for (let name in value) {
        result.push({
          key,
          name,
          value: value[name],
        })
      }

      return result

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
    const partial = (partials && partials[name]) || globalPartials[name]
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
        if (filters) {
          result = object.get(filters, name)
        }
        if (!result) {
          result = object.get(globalFilters, name)
        }
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
      instance,
      renderElementVnode,
      renderComponentVnode,
      renderTransition,
      renderModel,
      renderEventMethod,
      renderEventName,
      renderDirective,
      renderSpread,
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