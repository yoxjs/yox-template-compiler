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
  VNode,
  EventRuntime,
  DirectiveRuntime,
} from 'yox-type/src/vnode'

import {
  YoxInterface,
} from 'yox-type/src/yox'

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

import Computed from 'yox-observer/src/Computed'

import {
  clone,
  textVNodeOperator,
  commentVNodeOperator,
  elementVNodeOperator,
  componentVNodeOperator,
  fragmentVNodeOperator,
  portalVNodeOperator,
  slotVNodeOperator,
} from 'yox-snabbdom/src/snabbdom'

import {
  parseStyleString,
} from './helper'

import {
  formatNumberNativeAttributeValue,
  formatBooleanNativeAttributeValue,
} from './platform/web'

type Context = {
  scope: any,
  keypath: string,
}

export function render(
  instance: YoxInterface,
  template: Function,
  dependencies: Record<string, any>,
  data: Data,
  computed: Record<string, Computed> | undefined,
  filters: Record<string, Filter> | undefined,
  globalFilters: Record<string, Filter>,
  partials: Record<string, Function> | undefined,
  globalPartials: Record<string, Function>,
  directives: Record<string, DirectiveHooks> | undefined,
  globalDirectives: Record<string, DirectiveHooks>,
  transitions: Record<string, TransitionHooks> | undefined,
  globalTransitions: Record<string, TransitionHooks>,
) {

  let rootScope = object.merge(data, computed),

  rootKeypath = constant.EMPTY_STRING,

  contextStack: Context[] = [
    { scope: rootScope, keypath: rootKeypath }
  ],

  localPartials: Record<string, (scope: any, keypath: string, children: VNode[], components: VNode[]) => void> = { },

  // 模板渲染过程收集的 vnode
  children: VNode[] = [ ],

  // 模板渲染过程收集的组件
  components: VNode[] = [ ],

  renderComposeVNode = function (
    vnode: Data,
    children: Data[]
  ) {

    if (vnode.children.length) {
      children[children.length] = vnode
    }

  },

  appendVNodeProperty = function (vnode: Data, key: string, name: string, value: any) {

    if (vnode[key]) {
      vnode[key][name] = value
    }
    else {
      const map = { }
      map[name] = value
      vnode[key] = map
    }

  },

  renderStyleString = function (value: string) {
    const styles: Data = { }
    parseStyleString(
      value,
      function (key, value) {
        styles[key] = value
      }
    )
    return styles
  },

  renderStyleExpr = function (value: any) {
    if (is.array(value)) {
      const styles: Data = { }
      for (let i = 0, len = value.length; i < len; i++) {
        const item = renderStyleExpr(value[i])
        if (item) {
          for (let key in item) {
            styles[key] = item[key]
          }
        }
      }
      return styles
    }
    if (is.object(value)) {
      return value
    }
    if (is.string(value)) {
      return renderStyleString(value as string)
    }
  },

  renderTransition = function (name: string, transition: TransitionHooks) {
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

  createEventNameListener = function (type: string, ns?: string, isComponent?: boolean): Listener {
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

  createEventMethodListener = function (method: Function, runtime?: EventRuntime, isComponent?: boolean): Listener {
    return function (event: CustomEvent, data?: Data) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      const result = execute(
        method,
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

  renderEventMethod = function (key: string, value: string, name: string, ns: string, method: Function, runtime?: EventRuntime, isComponent?: boolean, isNative?: boolean) {
    if (runtime) {
      runtime.stack = contextStack
    }
    return {
      key,
      value,
      name,
      ns,
      isNative,
      listener: createEventMethodListener(method, runtime, isComponent),
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
      listener: createEventNameListener(to, toNs, isComponent),
    }
  },

  createDirectiveGetter = function (runtime: DirectiveRuntime): () => any {
    return function () {
      return (runtime.expr as Function)(runtime.stack)
    }
  },

  createDirectiveHandler = function (method: Function, runtime: DirectiveRuntime | void) {
    return function () {
      execute(
        method,
        instance,
        runtime
          ? (runtime.args as Function)(runtime.stack)
          : constant.UNDEFINED
      )
    }
  },

  renderDirective = function (key: string, name: string, modifier: string, value: any, hooks: DirectiveHooks, runtime?: DirectiveRuntime, method?: Function) {

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

  renderSpread = function (vnode: Data, key: string, value: any) {

    if (is.object(value)) {

      // 数组也算一种对象
      // 延展操作符不支持数组
      if (process.env.NODE_ENV === 'development') {
        if (is.array(value)) {
          logger.fatal(`The spread operator can't be used by an array.`)
        }
      }

      for (let name in value) {
        appendVNodeProperty(
          vnode,
          key,
          name,
          value[name]
        )
      }

    }

  },

  renderSlots = function (render: Record<string, (children: VNode[], components: VNode[]) => void>) {
    const result = { }
    for (let name in render) {
      const children: VNode[] = [ ], components: VNode[] = [ ]
      render[name](children, components)

      // 就算是 undefined 也必须有值，用于覆盖旧值
      result[name] = children.length
        ? {
            vnodes: children,
            components: components.length
              ? components
              : constant.UNDEFINED
          }
        : constant.UNDEFINED

    }
    return result
  },

  // <slot name="xx"/>
  renderSlotChildren = function (name: string, children: VNode[]) {
    dependencies[name] = children
    const result = rootScope[name]
    if (result) {
      const { vnodes, components } = result
      if (components) {
        for (let i = 0, length = components.length; i < length; i++) {
          components[i].parent = instance
        }
      }
      for (let i = 0, length = vnodes.length; i < length; i++) {
        children[children.length] = clone(vnodes[i])
      }
      return constant.TRUE
    }
  },

  // {{> name}}
  renderPartial = function (
    name: string, scope: any, keypath: string, children: VNode[], components: VNode[],
    renderLocal?: (scope: any, keypath: string, children: VNode[], components: VNode[]) => void,
    render?: Function,
  ) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Partial is not recommended for use, it may be removed in the future.')
    }
    if (renderLocal) {
      renderLocal(scope, keypath, children, components)
      return
    }
    if (process.env.NODE_ENV === 'development') {
      if (!render) {
        logger.fatal(`The partial "${name}" can't be found.`)
      }
    }
    renderTemplate(render as Function, scope, keypath, children, components)
  },

  renderEach = function (
    holder: ValueHolder,
    renderChildren: Function,
    renderElse?: Function
  ) {

    let { keypath, value } = holder, length = 0,

    needKeypath = !!keypath, oldScopeStack = contextStack, currentKeypath = (array.last(contextStack) as Context).keypath

    if (is.array(value)) {
      length = value.length
      for (let i = 0; i < length; i++) {
        if (needKeypath) {
          currentKeypath = keypath + constant.RAW_DOT + i
          // slice + push 比直接 concat 快多了
          contextStack = oldScopeStack.slice()
          contextStack.push({
            scope: value[i],
            keypath: currentKeypath,
          })
        }
        renderChildren(
          value[i],
          currentKeypath,
          length,
          i
        )
      }
    }
    else if (is.object(value)) {
      const keys = object.keys(value)
      length = keys.length

      for (let i = 0; i < length; i++) {
        const key = keys[i]
        if (needKeypath) {
          // 这里 key 虽然可能为空，但也必须直接拼接
          // 因为不拼接就变成了原来的 keypath，这样更是错的，
          // 只能在使用上尽量避免 key 为空的用法
          currentKeypath = keypath + constant.RAW_DOT + key
          // slice + push 比直接 concat 快多了
          contextStack = oldScopeStack.slice()
          contextStack.push({
            scope: value[key],
            keypath: currentKeypath,
          })
        }
        renderChildren(
          value[key],
          currentKeypath,
          length,
          key
        )
      }
    }

    if (contextStack !== oldScopeStack) {
      contextStack = oldScopeStack
    }

    if (renderElse && length === 0) {
      renderElse()
    }

  },

  renderRange = function (
    from: number,
    to: number,
    equal: boolean,
    renderChildren: Function,
    renderElse?: Function
  ) {

    let count = 0, length = 0, currentKeypath = (array.last(contextStack) as Context).keypath

    if (from < to) {
      length = to - from
      if (equal) {
        for (let i = from; i <= to; i++) {
          renderChildren(
            i,
            currentKeypath,
            length,
            count++
          )
        }
      }
      else {
        for (let i = from; i < to; i++) {
          renderChildren(
            i,
            currentKeypath,
            length,
            count++
          )
        }
      }
    }
    else {
      length = from - to
      if (equal) {
        for (let i = from; i >= to; i--) {
          renderChildren(
            i,
            currentKeypath,
            length,
            count++
          )
        }
      }
      else {
        for (let i = from; i > to; i--) {
          renderChildren(
            i,
            currentKeypath,
            length,
            count++
          )
        }
      }
    }

    if (renderElse && length === 0) {
      renderElse()
    }

  },

  findKeypath = function (
    stack: Context[],
    index: number,
    name: string,
    lookup?: boolean,
    isFirstCall?: boolean
  ) {

    const { scope, keypath } = stack[index],

    currentKeypath = keypathUtil.join(keypath, name),

    result = object.get(scope, name)

    if (result) {
      return setHolder(
        result.value,
        currentKeypath
      )
    }

    if (isFirstCall) {
      setHolder(
        constant.UNDEFINED,
        currentKeypath
      )
    }

    if (lookup && index > 0) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`The data "${currentKeypath}" can't be found in the current context, start looking up.`)
      }
      return findKeypath(stack, index - 1, name, lookup)
    }

  },

  lookupKeypath = function (
    getIndex: (stack: Context[]) => number,
    keypath: string,
    lookup?: boolean,
    stack?: Context[],
    filter?: Function
  ) {

    const currentStack = stack || contextStack

    return findKeypath(currentStack, getIndex(currentStack), keypath, lookup, constant.TRUE) || (
      filter
        ? setHolder(filter)
        : globalHolder
    )

  },

  findProp = function (
    stack: Context[],
    index: number,
    name: string
  ) {

    const { scope, keypath } = stack[index],

    currentKeypath = keypath ? keypath + constant.RAW_DOT + name : name

    if (name in scope) {
      return setHolder(
        scope[name],
        currentKeypath
      )
    }

    if (index > 0) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`The data "${currentKeypath}" can't be found in the current context, start looking up.`)
      }
      return findProp(stack, index - 1, name)
    }

  },

  lookupProp = function (
    name: string,
    value: any,
    stack?: Context[],
    filter?: Function
  ) {

    const currentStack = stack || contextStack,

    index = currentStack.length - 1,

    { keypath } = currentStack[index],

    currentKeypath = keypath ? keypath + constant.RAW_DOT + name : name

    if (value !== constant.UNDEFINED) {
      return setHolder(
        value,
        currentKeypath
      )
    }

    return index > 0 && findProp(currentStack, index - 1, name) || (
      filter
        ? setHolder(filter)
        : setHolder(constant.UNDEFINED, currentKeypath)
    )

  },

  getThis = function (
    value: any,
    stack?: Context[]
  ) {

    const currentStack = stack || contextStack,

    { keypath } = currentStack[currentStack.length - 1]

    return setHolder(
      value,
      keypath
    )

  },

  getThisByIndex = function (
    getIndex: (stack: Context[]) => number,
    stack?: Context[]
  ) {

    const currentStack = stack || contextStack,

    { scope, keypath } = currentStack[getIndex(currentStack)]

    return setHolder(
      scope,
      keypath
    )

  },

  getProp = function (
    name: string,
    value: any,
    stack?: Context[]
  ) {

    const currentStack = stack || contextStack,

    { keypath } = currentStack[currentStack.length - 1]

    return setHolder(
      value,
      keypath ? keypath + constant.RAW_DOT + name : name
    )

  },

  getPropByIndex = function (
    getIndex: (stack: Context[]) => number,
    name: string,
    stack?: Context[]
  ) {

    const currentStack = stack || contextStack,

    { scope, keypath } = currentStack[getIndex(currentStack)]

    return setHolder(
      scope[name],
      keypath ? keypath + constant.RAW_DOT + name : name
    )

  },

  readKeypath = function (
    value: any,
    keypath: string
  ) {
    const result = object.get(value, keypath)
    return setHolder(
      result ? result.value : constant.UNDEFINED
    )
  },

  setHolder = function (value: any, keypath?: string) {

    if (value && is.func(value.get)) {
      value = value.get()
    }

    globalHolder.keypath = keypath
    globalHolder.value = value

    if (keypath !== constant.UNDEFINED) {
      dependencies[keypath] = value
    }

    return globalHolder

  },

  renderTemplate = function (render: Function, scope: any, keypath: string, children: VNode[], components: VNode[]) {
    render(
      renderComposeVNode,
      renderStyleString,
      renderStyleExpr,
      renderTransition,
      renderModel,
      renderEventMethod,
      renderEventName,
      renderDirective,
      renderSpread,
      renderSlots,
      renderSlotChildren,
      renderPartial,
      renderEach,
      renderRange,
      appendVNodeProperty,
      formatNumberNativeAttributeValue,
      formatBooleanNativeAttributeValue,
      lookupKeypath,
      lookupProp,
      getThis,
      getThisByIndex,
      getProp,
      getPropByIndex,
      readKeypath,
      execute,
      setHolder,
      toString,
      textVNodeOperator,
      commentVNodeOperator,
      elementVNodeOperator,
      componentVNodeOperator,
      fragmentVNodeOperator,
      portalVNodeOperator,
      slotVNodeOperator,
      instance,
      filters,
      globalFilters,
      localPartials,
      partials,
      globalPartials,
      directives,
      globalDirectives,
      transitions,
      globalTransitions,
      scope,
      keypath,
      children,
      components
    )
  }

  renderTemplate(template, rootScope, rootKeypath, children, components)

  if (process.env.NODE_ENV === 'development') {
    if (children.length > 1) {
      logger.fatal(`The template should have just one root element.`)
    }
  }

  return children[0]

}