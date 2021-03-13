import {
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_CUSTOM,
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

  let $scope: Data = { $keypath: constant.EMPTY_STRING },

  $stack = [ $scope ],

  localPartials: Record<string, Function> = {},

  findValue = function (stack: any[], index: number, key: string, lookup: boolean, defaultKeypath?: string): ValueHolder {

    let scope = stack[index],

    keypath = keypathUtil.join(scope.$keypath, key),

    value: any = stack,

    holder = globalHolder

    // 如果最后还是取不到值，用回最初的 keypath
    if (defaultKeypath === constant.UNDEFINED) {
      defaultKeypath = keypath
    }

    // 如果取的是 scope 上直接有的数据，如 $keypath
    if (scope[key] !== constant.UNDEFINED) {
      value = scope[key]
    }

    // 如果取的是数组项，则要更进一步
    else if (scope.$item !== constant.UNDEFINED) {
      scope = scope.$item

      // 到这里 scope 可能为空
      // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

      // 取 this
      if (key === constant.EMPTY_STRING) {
        value = scope
      }
      // 取 this.xx
      else if (scope != constant.NULL && scope[key] !== constant.UNDEFINED) {
        value = scope[key]
      }
    }

    if (value === stack) {
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
    }

    holder.value = value
    holder.keypath = keypath

    return holder

  },

  createEventListener = function (type: string): Listener {
    return function (event: CustomEvent, data?: Data) {
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
  ): Listener {
    return function (event: CustomEvent, data?: Data) {

      const method = context[name]

      if (CustomEvent.is(event)) {

        let result: any = constant.UNDEFINED

        if (args) {
          const scope = array.last(stack)
          if (scope) {
            scope.$event = event
            scope.$data = data
            result = execute(method, context, args(stack))
            scope.$event =
            scope.$data = constant.UNDEFINED
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
          args ? args(stack) : constant.UNDEFINED
        )
      }

    }
  },

  createGetter = function (getter: Function, stack: any[]): () => any {
    return function () {
      return getter(stack)
    }
  },

  renderTextVnode = function (value: string) {
    return {
      tag: TAG_TEXT,
      isText: constant.TRUE,
      text: value,
      context,
      keypath: $scope.$keypath,
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
      name: constant.EMPTY_STRING,
      key: DIRECTIVE_MODEL,
      value: holder.value,
      modifier: holder.keypath,
      hooks: directives[DIRECTIVE_MODEL]
    }
  },

  renderEventMethod = function (params: Data) {
    return {
      key: field.DIRECTIVES,
      name: params.key,
      value: {
        ns: DIRECTIVE_EVENT,
        name: params.name,
        key: params.key,
        value: params.value,
        modifier: params.modifier,
        hooks: directives[DIRECTIVE_EVENT],
        handler: createMethodListener(params.method, params.args, $stack),
      }
    }
  },

  renderEventName = function (params: Data) {
    return {
      key: field.DIRECTIVES,
      name: params.key,
      value: {
        ns: DIRECTIVE_EVENT,
        name: params.name,
        key: params.key,
        value: params.value,
        modifier: params.modifier,
        hooks: directives[DIRECTIVE_EVENT],
        handler: createEventListener(params.event),
      }
    }
  },

  renderDirective = function (params: Data) {

    const hooks = directives[params.name]

    if (process.env.NODE_ENV === 'development') {
      if (!hooks) {
        logger.fatal(`The directive ${name} can't be found.`)
      }
    }

    return {
      key: field.DIRECTIVES,
      name: params.key,
      value: {
        ns: DIRECTIVE_CUSTOM,
        name: params.name,
        key: params.key,
        value: 1,
        hooks,
        modifier: params.modifier,
        getter: params.getter ? createGetter(params.getter, $stack) : constant.UNDEFINED,
        handler: params.method ? createMethodListener(params.method, params.args, $stack) : constant.UNDEFINED,
      }
    }

  },

  renderSpreadVnode = function (value: any) {

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

  renderCommentVnode = function () {
    // 注释节点和文本节点需要有个区分
    // 如果两者都没有 tag，则 patchVnode 时，会认为两者是 patchable 的
    return {
      tag: TAG_COMMENT,
      isComment: constant.TRUE,
      text: constant.EMPTY_STRING,
      keypath: $scope.$keypath,
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
    data.keypath = $scope.$keypath

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
    data.keypath = $scope.$keypath

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
    let myStack = stack || $stack, index = myStack.length - 1
    if (offset) {
      index -= offset
    }
    let result = findValue(myStack, index, name, lookup)
    return holder ? result : result.value
  },

  renderExpressionMemberKeypath = function (
    identifier: string,
    runtimeKeypath: string[]
  ) {
    array.unshift(runtimeKeypath, identifier)
    return array.join(runtimeKeypath, constant.RAW_DOT)
  },

  renderExpressionMemberLiteral = function (
    value: any,
    staticKeypath: string | void,
    runtimeKeypath: string[] | void,
    holder: boolean | void
  ) {
    if (runtimeKeypath !== constant.UNDEFINED) {
      staticKeypath = array.join(runtimeKeypath as string[], constant.RAW_DOT)
    }
    const match = object.get(value, staticKeypath as string)
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

  eachHandler = function (
    render: Function,
    item: any,
    key: string | number,
    keypath: string,
    index: string | void,
    length: number | void
  ) {

    const lastScope = $scope, lastStack = $stack

    // each 会改变 keypath
    $scope = { $keypath: keypath }
    $stack = lastStack.concat($scope)

    // 避免模板里频繁读取 list.length
    if (length !== constant.UNDEFINED) {
      $scope.$length = length
    }

    // 业务层是否写了 expr:index
    if (index) {
      $scope[index] = key
    }

    // 无法通过 context.get($keypath + key) 读取到数据的场景
    // 必须把 item 写到 scope
    if (!keypath) {
      $scope.$item = item
    }

    const result = render()

    $scope = lastScope
    $stack = lastStack

    return result

  },

  renderEach = function (
    render: Function,
    holder: ValueHolder,
    index: string | void
  ) {

    const { keypath, value } = holder, result: any[] = []

    if (is.array(value)) {
      for (let i = 0, length = value.length; i < length; i++) {
        result.push(
          eachHandler(
            render,
            value[i],
            i,
            keypath
              ? keypathUtil.join(keypath, constant.EMPTY_STRING + i)
              : constant.EMPTY_STRING,
            index,
            length
          )
        )
      }
    }
    else if (is.object(value)) {
      for (let key in value) {
        result.push(
          eachHandler(
            render,
            value[key],
            key,
            keypath
              ? keypathUtil.join(keypath, key)
              : constant.EMPTY_STRING,
            index
          )
        )
      }
    }

    return result

  },

  renderRange = function (
    render: Function,
    from: number,
    to: number,
    equal: boolean,
    index: string | void
  ) {

    let count = 0, result: any[] = []

    if (from < to) {
      if (equal) {
        for (let i = from; i <= to; i++) {
          result.push(
            eachHandler(
              render,
              i,
              count++,
              constant.EMPTY_STRING,
              index
            )
          )
        }
      }
      else {
        for (let i = from; i < to; i++) {
          result.push(
            eachHandler(
              render,
              i,
              count++,
              constant.EMPTY_STRING,
              index
            )
          )
        }
      }
    }
    else {
      if (equal) {
        for (let i = from; i >= to; i--) {
          result.push(
            eachHandler(
              render,
              i,
              count++,
              constant.EMPTY_STRING,
              index
            )
          )
        }
      }
      else {
        for (let i = from; i > to; i--) {
          result.push(
            eachHandler(
              render,
              i,
              count++,
              constant.EMPTY_STRING,
              index
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
      renderExpressionMemberKeypath,
      renderExpressionMemberLiteral,
      renderExpressionCall,
      renderTextVnode,
      renderNativeAttribute,
      renderNativeProperty,
      renderProperty,
      renderLazy,
      renderTransition,
      getTransition,
      renderModel,
      getModel,
      renderEventMethod,
      renderEventName,
      renderDirective,
      renderSpreadVnode,
      renderCommentVnode,
      renderElementVnode,
      renderComponentVnode,
      renderSlot,
      renderPartial,
      renderImport,
      renderEach,
      renderRange,
      toString,
    )
  }

  return renderTemplate(template)

}