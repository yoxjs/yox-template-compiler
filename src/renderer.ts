import {
  DIRECTIVE_MODEL,
  DIRECTIVE_CUSTOM,
  MAGIC_VAR_KEYPATH,
  MAGIC_VAR_LENGTH,
} from 'yox-config/src/config'

import {
  Data,
  Listener,
  LazyValue,
  ValueHolder,
} from 'yox-type/src/type'

import {
  VNode,
} from 'yox-type/src/vnode'

import {
  DirectiveHooks,
  TransitionHooks,
} from 'yox-type/src/hooks'

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

const TAG_TEXT = '#',

TAG_COMMENT = '!'

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

  findValue = function (stack: any[], index: number, key: string, lookup: boolean, defaultKeypath?: string): ValueHolder {

    let baseKeypath = stack[index],

    keypath = keypathUtil.join(baseKeypath, key),

    value: any = stack,

    holder = globalHolder

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
        return findValue(stack, index - 1, key, lookup, defaultKeypath)
      }

      // 到头了，最后尝试过滤器
      const result = object.get(filters, key)
      if (result) {
        holder = result
        holder.keypath = key
      }
      else {
        holder.value = constant.UNDEFINED
        holder.keypath = defaultKeypath
      }
      return holder

    }

    holder.value = value
    holder.keypath = keypath

    return holder

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

  createEventMethodListener = function (isComponent: boolean, name: string, args: Function | void, stack: any[]): Listener {
    return function (event: CustomEvent, data?: Data) {

      // 监听组件事件不用处理父组件传下来的事件
      if (isComponent && event.phase === CustomEvent.PHASE_DOWNWARD) {
        return
      }

      let methodArgs: any

      if (args) {
        methodArgs = args(stack, event, data)
        // 1 个或 0 个参数可优化调用方式，即 method.call 或直接调用函数
        if (methodArgs.length < 2) {
          methodArgs = methodArgs[0]
        }
      }
      else {
        methodArgs = data ? [event, data] : event
      }

      return execute(
        context[name],
        context,
        methodArgs
      )

    }
  },

  createDirectiveGetter = function (getter: Function, stack: any[]): () => any {
    return function () {
      return getter(stack)
    }
  },

  createDirectiveHandler = function (name: string, args: Function | void, stack: any[]) {
    return function () {

      let methodArgs: any = constant.UNDEFINED

      if (args) {
        methodArgs = args(stack)
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
      key: field.DIRECTIVES,
      name: DIRECTIVE_MODEL,
      value: getModel(holder),
    }
  },

  getModel = function (holder: ValueHolder) {
    return {
      ns: DIRECTIVE_MODEL,
      key: DIRECTIVE_MODEL,
      name: constant.EMPTY_STRING,
      value: holder.value,
      modifier: holder.keypath,
      hooks: directives[DIRECTIVE_MODEL],
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
    return {
      key: params.key,
      value: params.value,
      name: params.from,
      ns: params.fromNs,
      isNative: params.isNative,
      listener: createEventMethodListener(params.isComponent, params.method, params.args, keypathStack),
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

  renderDirective = function (params: Data) {
    return {
      key: field.DIRECTIVES,
      name: params.key,
      value: getDirective(params),
    }
  },

  getDirective = function (params: Data) {

    const hooks = directives[params.name]

    if (process.env.NODE_ENV === 'development') {
      if (!hooks) {
        logger.fatal(`The directive "${params.name}" can't be found.`)
      }
    }

    return {
      ns: DIRECTIVE_CUSTOM,
      key: params.key,
      name: params.name,
      value: params.value,
      modifier: params.modifier,
      hooks,
      getter: params.getter ? createDirectiveGetter(params.getter, keypathStack) : constant.UNDEFINED,
      handler: params.method ? createDirectiveHandler(params.method, params.args, keypathStack) : constant.UNDEFINED,
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
      tag: TAG_TEXT,
      isText: constant.TRUE,
      text: value,
      context,
      keypath: currentKeypath,
    }
  },

  renderCommentVnode = function () {
    // 注释节点和文本节点需要有个区分
    // 如果两者都没有 tag，则 patchVnode 时，会认为两者是 patchable 的
    return {
      tag: TAG_COMMENT,
      isComment: constant.TRUE,
      text: constant.EMPTY_STRING,
      keypath: currentKeypath,
      context,
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

  normalizeAttributes = function (data: Data, attrs: any[]) {
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

  normalizeChildren = function (result: any[], childs: any[]) {
    flattenArray(
      childs,
      function (item) {
        // item 只能是 vnode
        if (item.isText) {
          const lastChild = array.last(result)
          if (lastChild && lastChild.isText) {
            lastChild.text += item.text
            return
          }
        }
        result.push(item)
      }
    )
  },

  renderElementVnode = function (
    data: Data,
    attrs: any[] | void,
    childs: any[] | void
  ) {

    data.context = context
    data.keypath = currentKeypath

    if (attrs) {
      normalizeAttributes(data, attrs)
    }

    if (childs) {
      const children: any[] = []
      normalizeChildren(children, childs)
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
    data.keypath = currentKeypath

    if (attrs) {
      normalizeAttributes(data, attrs)
    }

    if (slots) {
      const vnodeMap = {}
      for (let name in slots) {
        const children: any[] = []
        normalizeChildren(children, slots[name])
        // 就算是 undefined 也必须有值，用于覆盖旧值
        vnodeMap[name] = children.length
          ? children
          : constant.UNDEFINED
      }
      data.slots = vnodeMap
    }

    return data

  },

  renderExpressionIdentifier = function (
    name: string,
    lookup: boolean,
    offset?: number,
    holder?: boolean,
    stack?: any[]
  ) {
    let myStack = stack || keypathStack, index = myStack.length - 1
    if (offset) {
      index -= offset
    }
    let result = findValue(myStack, index, name, lookup)
    return holder ? result : result.value
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
    // 当 holder 为 true, args 为空时，args 会传入 false
    globalHolder.value = execute(fn, context, args || constant.UNDEFINED)
    return holder ? globalHolder : globalHolder.value
  },

  // <slot name="xx"/>
  renderSlot = function (name: string, render?: Function) {

    const vnodes = context.get(name)
    if (vnodes) {
      array.each(
        vnodes,
        function (vnode: VNode) {
          vnode.slot = name
          vnode.parent = context
        }
      )
      return vnodes
    }

    if (render) {
      return render()
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
    render: Function,
    holder: ValueHolder
  ) {

    let { keypath, value } = holder, result: any[] = [],

    needKeypath = !!keypath, oldKeypathStack = keypathStack, oldCurrentKeypath = currentKeypath

    if (is.array(value)) {
      for (let i = 0, length = value.length; i < length; i++) {
        if (needKeypath) {
          // keypath 和 i 都不可能为空，因此直接拼接比较快
          currentKeypath = keypath + constant.RAW_DOT + i
          keypathStack = oldKeypathStack.concat(currentKeypath)
        }
        result.push(
          render(
            currentKeypath || constant.EMPTY_STRING,
            length,
            needKeypath
              ? constant.UNDEFINED
              : value[i],
            i
          )
        )
      }
    }
    else if (is.object(value)) {
      for (let key in value) {
        if (needKeypath) {
          // key 可能是空字符串，因此用 keypathUtil.join
          currentKeypath = keypathUtil.join(keypath as string, key)
          keypathStack = oldKeypathStack.concat(currentKeypath)
        }
        result.push(
          render(
            currentKeypath || constant.EMPTY_STRING,
            constant.UNDEFINED,
            needKeypath
              ? constant.UNDEFINED
              : value[key],
            key
          )
        )
      }
    }

    if (currentKeypath !== oldCurrentKeypath) {
      currentKeypath = oldCurrentKeypath
      keypathStack = oldKeypathStack
    }

    return result

  },

  renderRange = function (
    render: Function,
    from: number,
    to: number,
    equal: boolean
  ) {

    let count = 0, length = 0, result: any[] = []

    if (from < to) {
      length = to - from
      if (equal) {
        for (let i = from; i <= to; i++) {
          result.push(
            render(
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
            render(
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
            render(
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
            render(
              currentKeypath,
              length,
              i,
              count++
            )
          )
        }
      }
    }

    return result

  },

  renderTemplate = function (render) {
    return render(
      renderExpressionIdentifier,
      renderExpressionMemberLiteral,
      renderExpressionCall,
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
      renderElementVnode,
      renderComponentVnode,
      renderSlot,
      renderPartial,
      renderImport,
      renderEach,
      renderRange,
      toString,
      array.last(keypathStack)
    )
  }

  return renderTemplate(template)

}