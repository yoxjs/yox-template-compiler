import {
  DIRECTIVE_CUSTOM,
} from 'yox-config/src/config'

import {
  Data,
  Filter,
  Listener,
  ValueHolder,
  DirectiveFunction,
} from 'yox-type/src/type'

import {
  TransitionHooks,
} from 'yox-type/src/hooks'

import {
  VNode,
  Directive,
  EventRuntime,
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

import globalHolder from 'yox-common/src/util/holder'

import Computed from 'yox-observer/src/Computed'

import {
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
  scopeValue: any,
  scopeKey?: string | number,
  keypath: string,
}

export function render(
  instance: YoxInterface,
  template: Function,
  rootScope: Data,
  filters: Record<string, Filter> | undefined,
  globalFilters: Record<string, Filter>,
  directives: Record<string, DirectiveFunction> | undefined,
  globalDirectives: Record<string, DirectiveFunction>,
  transitions: Record<string, TransitionHooks> | undefined,
  globalTransitions: Record<string, TransitionHooks>,
  addDependency: (keypath: string) => void
) {

  let rootKeypath = constant.EMPTY_STRING,

  contextStack: Context[] = [
    { scopeValue: rootScope, keypath: rootKeypath }
  ],

  // 模板渲染过程收集的 vnode
  children: VNode[] = [ ],

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

  createEventMethodListener = function (method: string, runtime?: EventRuntime, isComponent?: boolean): Listener {
    return function (event: CustomEvent, data?: Data) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      const result = callMethod(
        method,
        runtime
          ? runtime.execute(event, data)
          : (data ? [event, data] : [event])
      )

      if (result === constant.FALSE) {
        event.prevent().stop()
      }

    }
  },

  renderEventMethod = function (key: string, value: string, name: string, ns: string, method: string, runtime?: EventRuntime, isComponent?: boolean, isNative?: boolean) {
    return {
      key,
      value,
      name,
      ns,
      isNative,
      runtime,
      listener: createEventMethodListener(method, runtime, isComponent),
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

  renderDirective = function (key: string, name: string, modifier: string, value: any, create: DirectiveFunction): Directive {

    if (process.env.NODE_ENV === 'development') {
      if (!create) {
        logger.fatal(`The directive "${name}" can't be found.`)
      }
    }

    return {
      ns: DIRECTIVE_CUSTOM,
      name,
      value,
      modifier,
      create,
    }

  },

  callMethod = function (name: string, args: any[] | void) {

    const method = instance[name]

    if (process.env.NODE_ENV === 'development') {
      if (!method) {
        logger.fatal(`The method "${name}" can't be found.`)
      }
    }

    if (args && args.length > 0) {
      return execute(
        method,
        instance,
        args
      )
    }

    return instance[name]()

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
            scopeValue: value,
            scopeKey: i,
            keypath: currentKeypath,
          })
        }
        renderChildren(
          contextStack,
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
            scopeValue: value,
            scopeKey: key,
            keypath: currentKeypath,
          })
        }
        renderChildren(
          contextStack,
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
            contextStack,
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
            contextStack,
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
            contextStack,
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
            contextStack,
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

  renderSlot = function (name: string, parent?: YoxInterface) {
    addDependency(name)
    const target = rootScope[name]
    if (target) {
      if (target instanceof Computed) {
        // 如果 slot 透传好几层组件，最里面的那个组件调用 renderSlot 时，会把自己传入 parent 参数
        // 那么在它之上的每一层组件，都应该调用原始的渲染函数 getter，而不是调用经过封装的 get
        return parent
          ? target.getter(parent)
          : target.get()
      }
      return target
    }
  },

  findKeypath = function (
    stack: Context[],
    index: number,
    name: string,
    lookup?: boolean,
    isFirstCall?: boolean
  ) {

    const { scopeValue, scopeKey, keypath } = stack[index],

    scope = scopeKey !== constant.UNDEFINED ? scopeValue[scopeKey] : scopeValue,

    currentKeypath = keypath ? keypath + constant.RAW_DOT + name : name,

    result = object.get(scope, name)

    if (result) {
      return setValueHolder(
        result.value,
        currentKeypath
      )
    }

    if (isFirstCall) {
      setValueHolder(
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
    stack: Context[],
    index: number,
    keypath: string,
    lookup?: boolean,
    filter?: Function
  ) {

    return findKeypath(stack, index, keypath, lookup, constant.TRUE) || (
      filter
        ? setValueHolder(filter)
        : globalHolder
    )

  },

  findProp = function (
    stack: Context[],
    index: number,
    name: string
  ) {

    const { scopeValue, scopeKey, keypath } = stack[index],

    scope = scopeKey !== constant.UNDEFINED ? scopeValue[scopeKey] : scopeValue,

    currentKeypath = keypath ? keypath + constant.RAW_DOT + name : name

    if (name in scope) {
      return setValueHolder(
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
    stack: Context[],
    name: string,
    value: any,
    filter?: Function
  ) {

    const index = stack.length - 1,

    { keypath } = stack[index],

    currentKeypath = keypath ? keypath + constant.RAW_DOT + name : name

    if (value !== constant.UNDEFINED) {
      return setValueHolder(
        value,
        currentKeypath
      )
    }

    return index > 0 && findProp(stack, index - 1, name) || (
      filter
        ? setValueHolder(filter)
        : setValueHolder(constant.UNDEFINED, currentKeypath)
    )

  },

  getThisByIndex = function (
    stack: Context[],
    index: number
  ) {

    const { scopeValue, scopeKey, keypath } = stack[index]

    return setValueHolder(
      scopeKey !== constant.UNDEFINED ? scopeValue[scopeKey] : scopeValue,
      keypath
    )

  },

  getProp = function (
    stack: Context[],
    name: string,
    value: any
  ) {

    const { keypath } = stack[stack.length - 1]

    return setValueHolder(
      value,
      keypath ? keypath + constant.RAW_DOT + name : name
    )

  },

  getPropByIndex = function (
    stack: Context[],
    index: number,
    name: string
  ) {

    const { scopeValue, scopeKey, keypath } = stack[index]

    return setValueHolder(
      (scopeKey !== constant.UNDEFINED ? scopeValue[scopeKey] : scopeValue)[name],
      keypath ? keypath + constant.RAW_DOT + name : name
    )

  },

  readKeypath = function (
    value: any,
    keypath: string
  ) {
    const result = object.get(value, keypath)
    return setValueHolder(
      result ? result.value : constant.UNDEFINED
    )
  },

  setValueHolder = function (value: any, keypath?: string) {

    if (value && is.func(value.get)) {
      value = value.get()
    }

    globalHolder.keypath = keypath
    globalHolder.value = value

    if (keypath !== constant.UNDEFINED) {
      addDependency(keypath)
    }

    return globalHolder

  },

  renderTemplate = function (render: Function, scope: any, keypath: string, children: VNode[]) {
    render(
      renderStyleString,
      renderStyleExpr,
      renderTransition,
      renderModel,
      renderEventMethod,
      renderEventName,
      renderDirective,
      renderSpread,
      renderEach,
      renderRange,
      renderSlot,
      appendVNodeProperty,
      formatNumberNativeAttributeValue,
      formatBooleanNativeAttributeValue,
      lookupKeypath,
      lookupProp,
      getThisByIndex,
      getProp,
      getPropByIndex,
      readKeypath,
      setValueHolder,
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
      directives,
      globalDirectives,
      transitions,
      globalTransitions,
      contextStack,
      scope,
      keypath,
      children
    )
  }

  renderTemplate(template, rootScope, rootKeypath, children)

  if (process.env.NODE_ENV === 'development') {
    if (children.length > 1) {
      logger.fatal(`The template should have just one root element.`)
    }
  }

  return children[0]

}