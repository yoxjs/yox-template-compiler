import {
  SLOT_DATA_PREFIX,
} from 'yox-config/src/config'

import {
  Data,
  Listener,
  LazyValue,
  ValueHolder,
  PropertyHint,
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

import {
  DIRECTIVE_BINDING,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_CUSTOM,
} from 'yox-config/src/config'

import * as constant from 'yox-type/src/constant'

import isDef from 'yox-common/src/function/isDef'
import isUndef from 'yox-common/src/function/isUndef'
import execute from 'yox-common/src/function/execute'
import toString from 'yox-common/src/function/toString'
import CustomEvent from 'yox-common/src/util/CustomEvent'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as string from 'yox-common/src/util/string'
import * as logger from 'yox-common/src/util/logger'
import * as keypathUtil from 'yox-common/src/util/keypath'

import globalHolder from 'yox-common/src/util/holder'

import Observer from 'yox-observer/src/Observer'

function setPair(target: any, name: string, key: string, value: any) {
  const data = target[name] || (target[name] = {})
  data[key] = value
}

const KEY_DIRECTIVES = 'directives'

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

  $vnode: any,

  vnodeStack: VNode[][] = [],

  localPartials: Record<string, Function> = {},

  renderedSlots: Record<string, true> = {},

  findValue = function (stack: any[], index: number, key: string, lookup: boolean, depIgnore?: boolean, defaultKeypath?: string): ValueHolder {

    let scope = stack[index], keypath = keypathUtil.join(scope.$keypath, key), value: any = stack, holder = globalHolder

    // 如果最后还是取不到值，用回最初的 keypath
    if (isUndef(defaultKeypath)) {
      defaultKeypath = keypath
    }

    // 如果取的是 scope 上直接有的数据，如 $keypath
    if (isDef(scope[key])) {
      value = scope[key]
    }

    // 如果取的是数组项，则要更进一步
    else if (isDef(scope.$item)) {
      scope = scope.$item

      // 到这里 scope 可能为空
      // 比如 new Array(10) 然后遍历这个数组，每一项肯定是空

      // 取 this
      if (key === constant.EMPTY_STRING) {
        value = scope
      }
      // 取 this.xx
      else if (scope != constant.NULL && isDef(scope[key])) {
        value = scope[key]
      }
    }

    if (value === stack) {
      // 正常取数据
      value = observer.get(keypath, stack, depIgnore)
      if (value === stack) {

        if (lookup && index > 0) {
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`The data "${keypath}" can't be found in the current context, start looking up.`)
          }
          return findValue(stack, index - 1, key, lookup, depIgnore, defaultKeypath)
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

      if (event instanceof CustomEvent) {

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

  renderTextVnode = function (text: string) {
    const vnodeList = array.last(vnodeStack)
    if (vnodeList) {
      const lastVnode = array.last(vnodeList)
      if (lastVnode && lastVnode.isText) {
        (lastVnode.text as string) += text
      }
      else {
        const textVnode: any = {
          isText: constant.TRUE,
          text,
          context,
          keypath: $scope.$keypath,
        }
        array.push(vnodeList, textVnode)
      }
    }
  },

  renderAttributeVnode = function (name: string, value: string | void) {
    if ($vnode.isComponent) {
      setPair($vnode, 'props', name, value)
    }
    else {
      setPair($vnode, 'nativeAttrs', name, { name, value })
    }
  },

  renderPropertyVnode = function (name: string, hint: PropertyHint, value: any | void) {
    setPair($vnode, 'nativeProps', name, { name, value, hint })
  },

  renderLazyVnode = function (name: string, value: LazyValue) {
    setPair($vnode, 'lazy', name, value)
  },

  renderTransitionVnode = function (name: string) {
    $vnode.transition = transitions[name]
    if (process.env.NODE_ENV === 'development') {
      if (!$vnode.transition) {
        logger.fatal(`The transition "${name}" can't be found.`)
      }
    }
  },

  renderBindingVnode = function (name: string, holder: ValueHolder, hint?: PropertyHint): any {

    const key = keypathUtil.join(DIRECTIVE_BINDING, name)

    setPair(
      $vnode,
      KEY_DIRECTIVES,
      key,
      {
        ns: DIRECTIVE_BINDING,
        name,
        key,
        modifier: holder.keypath,
        hooks: directives[DIRECTIVE_BINDING],
        hint,
      }
    )

    return holder.value

  },

  renderModelVnode = function (holder: ValueHolder) {
    setPair(
      $vnode,
      KEY_DIRECTIVES,
      DIRECTIVE_MODEL,
      {
        ns: DIRECTIVE_MODEL,
        name: constant.EMPTY_STRING,
        key: DIRECTIVE_MODEL,
        value: holder.value,
        modifier: holder.keypath,
        hooks: directives[DIRECTIVE_MODEL]
      }
    )
  },

  renderEventMethodVnode = function (
    name: string, key: string,
    modifier: string, value: string,
    method: string, args: Function | void
  ) {
    setPair(
      $vnode,
      KEY_DIRECTIVES,
      key,
      {
        ns: DIRECTIVE_EVENT,
        name,
        key,
        value,
        modifier,
        hooks: directives[DIRECTIVE_EVENT],
        handler: createMethodListener(method, args, $stack),
      }
    )
  },

  renderEventNameVnode = function (
    name: string, key: string,
    modifier: string, value: string,
    event: string
  ) {
    setPair(
      $vnode,
      KEY_DIRECTIVES,
      key,
      {
        ns: DIRECTIVE_EVENT,
        name,
        key,
        value,
        modifier,
        hooks: directives[DIRECTIVE_EVENT],
        handler: createEventListener(event),
      }
    )
  },

  renderDirectiveVnode = function (
    name: string, key: string,
    modifier: string, value: string,
    method: string | void, args: Function | void, getter: Function | void
  ) {

    const hooks = directives[name]

    if (process.env.NODE_ENV === 'development') {
      if (!hooks) {
        logger.fatal(`The directive ${name} can't be found.`)
      }
    }

    setPair(
      $vnode,
      KEY_DIRECTIVES,
      key,
      {
        ns: DIRECTIVE_CUSTOM,
        name,
        key,
        value,
        hooks,
        modifier,
        getter: getter ? createGetter(getter, $stack) : constant.UNDEFINED,
        handler: method ? createMethodListener(method, args, $stack) : constant.UNDEFINED,
      }
    )

  },

  renderSpreadVnode = function (holder: ValueHolder) {

    const { value, keypath } = holder

    // 如果为 null 或 undefined，则不需要 warn
    if (value != constant.NULL) {
      // 数组也算一种对象，要排除掉
      if (is.object(value) && !is.array(value)) {

        object.each(
          value,
          function (value, key) {
            setPair($vnode, 'props', key, value)
          }
        )

        if (keypath) {
          const key = keypathUtil.join(DIRECTIVE_BINDING, keypath)
          setPair(
            $vnode,
            KEY_DIRECTIVES,
            key,
            {
              ns: DIRECTIVE_BINDING,
              name: constant.EMPTY_STRING,
              key,
              modifier: keypathUtil.join(keypath, constant.RAW_WILDCARD),
              hooks: directives[DIRECTIVE_BINDING],
            }
          )
        }

      }
    }

  },

  renderElementVnode = function (
    vnode: Data,
    tag: string | void,
    attrs: Function | void,
    childs: Function | void,
    slots: Record<string, Function> | void
  ) {

    if (tag) {
      const componentName = observer.get(tag)
      if (process.env.NODE_ENV === 'development') {
        if (!componentName) {
          logger.warn(`The dynamic component "${tag}" can't be found.`)
        }
      }
      vnode.tag = componentName
    }

    if (attrs) {
      $vnode = vnode
      attrs()
      $vnode = constant.UNDEFINED
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
          const vnodes = array.pop(vnodeStack) as VNode[]
          renderSlots[name] = vnodes.length ? vnodes : constant.UNDEFINED
        }
      )
      vnode.slots = renderSlots
    }

    vnode.context = context
    vnode.keypath = $scope.$keypath

    const vnodeList = array.last(vnodeStack)
    if (vnodeList) {
      array.push(vnodeList, vnode)
    }

    return vnode

  },

  renderExpressionIdentifier = function (
    name: string,
    lookup: boolean,
    offset?: number,
    holder?: boolean,
    depIgnore?: boolean,
    stack?: any[]
  ) {
    const myStack = stack || $stack,
    result = findValue(
      myStack,
      myStack.length - 1 - (offset || 0),
      name,
      lookup,
      depIgnore
    )
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
    if (isDef(runtimeKeypath)) {
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
  renderSlot = function (name: string, defaultRender?: Function) {

    const vnodeList = array.last(vnodeStack),

    vnodes = context.get(name)

    if (vnodeList) {
      if (vnodes) {
        array.each(
          vnodes,
          function (vnode: VNode) {
            array.push(vnodeList, vnode)
            vnode.slot = name
            vnode.parent = context
          }
        )
      }
      else if (defaultRender) {
        defaultRender()
      }
    }

    // 不能重复输出相同名称的 slot
    if (process.env.NODE_ENV === 'development') {
      if (renderedSlots[name]) {
        logger.fatal(`The slot "${string.slice(name, SLOT_DATA_PREFIX.length)}" can't render more than one time.`)
      }
      renderedSlots[name] = constant.TRUE
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
          renderExpressionIdentifier,
          renderExpressionMemberKeypath,
          renderExpressionMemberLiteral,
          renderExpressionCall,
          renderTextVnode,
          renderAttributeVnode,
          renderPropertyVnode,
          renderLazyVnode,
          renderTransitionVnode,
          renderBindingVnode,
          renderModelVnode,
          renderEventMethodVnode,
          renderEventNameVnode,
          renderDirectiveVnode,
          renderSpreadVnode,
          renderElementVnode,
          renderSlot,
          renderPartial,
          renderImport,
          renderEach,
          renderRange,
          renderEqualRange,
          toString
        )
      }
      else if (process.env.NODE_ENV === 'development') {
        logger.fatal(`The partial "${name}" can't be found.`)
      }
    }
  },

  eachHandler = function (
    generate: Function,
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
    if (isDef(length)) {
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

    generate()

    $scope = lastScope
    $stack = lastStack

  },

  renderEach = function (
    generate: Function,
    holder: ValueHolder,
    index: string | void
  ) {

    const { keypath, value } = holder

    if (is.array(value)) {
      for (let i = 0, length = value.length; i < length; i++) {
        eachHandler(
          generate,
          value[i],
          i,
          keypath
            ? keypathUtil.join(keypath, constant.EMPTY_STRING + i)
            : constant.EMPTY_STRING,
          index,
          length
        )
      }
    }
    else if (is.object(value)) {
      for (let key in value) {
        eachHandler(
          generate,
          value[key],
          key,
          keypath
            ? keypathUtil.join(keypath, key)
            : constant.EMPTY_STRING,
          index
        )
      }
    }

  },

  renderRange = function (
    generate: Function,
    from: number,
    to: number,
    index: string | void
  ) {

    let count = 0

    if (from < to) {
      for (let i = from; i < to; i++) {
        eachHandler(
          generate,
          i,
          count++,
          constant.EMPTY_STRING,
          index
        )
      }
    }
    else {
      for (let i = from; i > to; i--) {
        eachHandler(
          generate,
          i,
          count++,
          constant.EMPTY_STRING,
          index
        )
      }
    }

  },

  renderEqualRange = function (
    generate: Function,
    from: number,
    to: number,
    index: string | void
  ) {

    let count = 0

    if (from < to) {
      for (let i = from; i <= to; i++) {
        eachHandler(
          generate,
          i,
          count++,
          constant.EMPTY_STRING,
          index
        )
      }
    }
    else {
      for (let i = from; i >= to; i--) {
        eachHandler(
          generate,
          i,
          count++,
          constant.EMPTY_STRING,
          index
        )
      }
    }

  }

  return template(
    renderExpressionIdentifier,
    renderExpressionMemberKeypath,
    renderExpressionMemberLiteral,
    renderExpressionCall,
    renderTextVnode,
    renderAttributeVnode,
    renderPropertyVnode,
    renderLazyVnode,
    renderTransitionVnode,
    renderBindingVnode,
    renderModelVnode,
    renderEventMethodVnode,
    renderEventNameVnode,
    renderDirectiveVnode,
    renderSpreadVnode,
    renderElementVnode,
    renderSlot,
    renderPartial,
    renderImport,
    renderEach,
    renderRange,
    renderEqualRange,
    toString
  )

}