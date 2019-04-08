
import isDef from 'yox-common/function/isDef'
import toString from 'yox-common/function/toString'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as config from 'yox-config'
import * as snabbdom from 'yox-snabbdom'

import * as expressionCompiler from 'yox-expression-compiler'
import Identifier from 'yox-expression-compiler/src/node/Identifier'

import * as helper from './src/helper'
import * as nodeType from './src/nodeType'

import Attribute from './src/node/Attribute'
import Directive from './src/node/Directive'
import Each from './src/node/Each'
import Element from './src/node/Element'
import Else from './src/node/Else'
import ElseIf from './src/node/ElseIf'
import Expression from './src/node/Expression'
import If from './src/node/If'
import Import from './src/node/Import'
import Partial from './src/node/Partial'
import Spread from './src/node/Spread'
import Text from './src/node/Text'


// 缓存编译结果
let compileCache = { }



const RAW_INVALID = 'invalid'

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} content
 * @return {Array}
 */
export function compile(content) {



}

/**
 * 把抽象语法树转成可执行的渲染函数
 *
 * @param {Array} ast
 * @return {Array}
 */
export function convert(ast) {
  return ast.map(
    function (item) {
      return new Function('a', 'b', 'c', 'e', 'i', 'm', 'o', 'p', 's', 'x', 'y', 'z', `return ${item.stringify()}`)
    }
  )
}

/**
 * 渲染抽象语法树
 *
 * @param {Function} render 编译出来的渲染函数
 * @param {Function} getter 表达式求值函数
 * @param {Yox} instance 组件实例
 * @return {Object}
 */
export function render(render, getter, instance) {

  /**
   *
   * 表达式求值，通常是从当前层级依次往上查找，如果到根层级还找不到，返回 undefined
   *
   * 层级只会因为 each 改变，其他语法不具有这个能力。
   *
   * 需要特殊处理的是，this 或 this.x 无需向上查找（由 getter 函数处理）
   *
   * 此外，如果表达式是单向绑定或双向绑定，无需收集到模板依赖中（由 getter 函数处理）
   *
   */

  let scope = { }, keypath = char.CHAR_BLANK, keypathStack = [ keypath, scope ], values,

  currentElement,
  elementStack = [ ],

  pushElement = function (element) {
    currentElement = element
    array.push(
      elementStack,
      element
    )
  },

  popElement = function (lastElement) {
    currentElement = lastElement
    array.pop(elementStack)
  },

  currentComponent,
  componentStack = [ ],

  pushComponent = function (component) {
    currentComponent = component
    array.push(
      componentStack,
      component
    )
  },

  popComponent = function (lastComponent) {
    currentComponent = lastComponent
    array.pop(componentStack)
  },

  addAttr = function (name, value) {
    let attrs = currentElement.attrs || (currentElement.attrs = { })
    attrs[ name ] = value
  },

  addDirective = function (name, modifier, value) {
    let directives = currentElement.directives || (currentElement.directives = { })
    return directives[ keypathUtil.join(name, modifier) ] = {
      name,
      modifier,
      value,
      keypath,
      keypathStack,
    }
  },

  addChild = function (node) {

    let children = currentElement[ env.RAW_CHILDREN ], lastChild = currentElement.lastChild

    if (snabbdom.isVnode(node)) {
      if (node[ env.RAW_COMPONENT ]) {
        node.parent = instance
      }
      array.push(children, node)
      if (lastChild) {
        currentElement.lastChild = env.NULL
      }
    }
    else if (snabbdom.isTextVnode(lastChild)) {
      lastChild[ env.RAW_TEXT ] += toString(node)
    }
    else {
      array.push(
        children,
        currentElement.lastChild = snabbdom.createTextVnode(node)
      )
    }

  },

  addSlot = function (name, slot) {
    let slots = currentComponent.slots || (currentComponent.slots = { })
    if (slot[ env.RAW_LENGTH ]) {
      if (slots[ name ]) {
        array.push(
          slots[ name ],
          slot
        )
      }
      else {
        slots[ name ] = slot
      }
    }
    // slot 即使是空也必须覆盖组件旧值
    else {
      slots[ name ] = env.UNDEFINED
    }
  },

  attrHandler = function (node) {
    if (isDef(node)) {
      if (is.func(node)) {
        node()
      }
      else {
        let name = node[ env.RAW_NAME ], expr = node[ env.RAW_EXPR ], value
        if (node[ env.RAW_TYPE ] === nodeType.ATTRIBUTE) {
          if (object.has(node, env.RAW_VALUE)) {
            value = node[ env.RAW_VALUE ]
          }
          else if (expr) {
            value = o(expr, expr[ env.RAW_STATIC_KEYPATH ])
            if (expr[ env.RAW_STATIC_KEYPATH ]) {
              addDirective(
                config.DIRECTIVE_BINDING,
                name,
                expr[ env.RAW_ABSOLUTE_KEYPATH ]
              )
            }
          }
          else if (node[ env.RAW_CHILDREN ]) {
            value = getValue(node[ env.RAW_CHILDREN ])
          }
          else {
            value = currentElement[ env.RAW_COMPONENT ] ? env.TRUE : name
          }
          addAttr(name, value)
        }
        else {
          if (name === config.DIRECTIVE_MODEL) {
            value = (o(expr, expr[ env.RAW_STATIC_KEYPATH ]), expr[ env.RAW_ABSOLUTE_KEYPATH ])
            currentElement.model = value
          }
          else if (object.has(node, env.RAW_VALUE)) {
            value = node[ env.RAW_VALUE ]
          }
          else if (object.has(node, env.RAW_CHILDREN)) {
            value = getValue(node[ env.RAW_CHILDREN ])
          }
          addDirective(name, node.modifier, value)[ env.RAW_EXPR ] = expr
        }
      }
    }
  },

  childHandler = function (node) {
    if (isDef(node)) {
      if (is.func(node)) {
        node()
      }
      else if (values) {
        values[ values[ env.RAW_LENGTH ] ] = node
      }
      else if (currentElement[ env.RAW_CHILDREN ]) {

        if (is.array(node)) {
          array.each(
            node,
            addChild
          )
        }
        else {
          addChild(node)
        }

      }
      else {
        attrHandler(node)
      }
    }
  },

  getValue = function (generate) {
    values = [ ]
    generate()
    let value = values[ env.RAW_LENGTH ] > 1
      ? array.join(values, '')
      : values[ 0 ]
    values = env.NULL
    return value
  },

  // 处理 children
  x = function () {
    array.each(
      arguments,
      childHandler
    )
  },

  // 处理元素 attribute
  y = function () {
    array.each(
      arguments,
      attrHandler
    )
  },

  // 处理 properties
  z = function () {
    array.each(
      arguments,
      function (item) {
        let name = item[ env.RAW_NAME ], value = item[ env.RAW_VALUE ]
        if (is.object(value)) {
          let expr = value
          value = o(expr, expr[ env.RAW_STATIC_KEYPATH ])
          if (expr[ env.RAW_STATIC_KEYPATH ]) {
            addDirective(
              config.DIRECTIVE_BINDING,
              name,
              expr[ env.RAW_ABSOLUTE_KEYPATH ]
            ).prop = env.TRUE
          }
        }
        let props = currentElement.props || (currentElement.props = { })
        props[ name ] = value
      }
    )
  },

  // template
  a = function (name, childs) {

    if (currentComponent && (name = getValue(name))) {

      let lastElement = currentElement, children = [ ]

      pushElement({
        children,
      })

      childs()

      addSlot(
        config.SLOT_DATA_PREFIX + name,
        children
      )

      popElement(lastElement)

    }

  },
  // slot
  b = function (name) {
    name = getValue(name)
    if (name) {
      let result = getter(config.SLOT_DATA_PREFIX + name)
      return is.array(result) && result[ env.RAW_LENGTH ] === 1
        ? result[ 0 ]
        : result
    }
  },

  // create
  c = function (component, tag, childs, attrs, props, ref, transition, key) {

    let lastElement = currentElement, lastComponent = currentComponent

    pushElement({
      component,
    })

    if (component) {
      pushComponent(currentElement)
    }

    if (key) {
      key = getValue(key)
    }

    if (transition) {
      transition = getValue(transition)
    }

    if (ref) {
      ref = getValue(ref)
    }

    if (attrs) {
      attrs()
    }

    if (props) {
      props()
    }

    let children
    if (childs) {
      children = currentElement[ env.RAW_CHILDREN ] = [ ]
      childs()
      if (component) {
        addSlot(
          config.SLOT_DATA_PREFIX + env.RAW_CHILDREN,
          children
        )
        children = env.UNDEFINED
      }
    }

    if (string.startsWith(tag, '$')) {
      let name = string.slice(tag, 1)
      tag = o(new Identifier(name, name))
    }

    let result = snabbdom[ component ? 'createComponentVnode' : 'createElementVnode' ](
      tag,
      currentElement.attrs,
      currentElement.props,
      currentElement.directives,
      children,
      currentElement.slots,
      currentElement.model,
      ref,
      key,
      instance,
      instance.transition(transition)
    )

    popElement(lastElement)

    if (component) {
      popComponent(lastComponent)
    }

    return result

  },
  // comment
  m = snabbdom.createCommentVnode,
  // each
  e = function (expr, generate, index) {

    let value = o(expr),

      absoluteKeypath = expr[ env.RAW_ABSOLUTE_KEYPATH ],
      eachKeypath = absoluteKeypath || keypathUtil.join(keypath, expr.raw),
      eachHandler = function (item, key) {

        let lastScope = scope, lastKeypath = keypath, lastKeypathStack = keypathStack

        scope = { }
        keypath = keypathUtil.join(eachKeypath, key)
        keypathStack = object.copy(keypathStack)
        array.push(keypathStack, keypath)
        array.push(keypathStack, scope)

        // 从下面这几句赋值可以看出
        // scope 至少会有 'keypath' 'this' 'index' 等几个值
        scope[ config.SPECIAL_KEYPATH ] = keypath

        // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
        // 因为通过 instance.get() 无法获取数据
        if (!absoluteKeypath) {
          scope[ env.RAW_THIS ] = item
        }

        if (index) {
          scope[ index ] = key
        }

        generate()

        scope = lastScope
        keypath = lastKeypath
        keypathStack = lastKeypathStack

      }

    if (is.array(value)) {
      array.each(value, eachHandler)
    }
    else if (is.object(value)) {
      object.each(value, eachHandler)
    }
    else if (is.func(value)) {
      value(eachHandler)
    }

  },
  // output（e 被 each 占了..)
  o = function (expr, binding) {
    return getter(expr, keypathStack, binding)
  },
  // spread
  s = function (expr) {
    let staticKeypath = expr[ env.RAW_STATIC_KEYPATH ], value
    // 只能作用于 attribute 层级
    if (!currentElement[ env.RAW_CHILDREN ]
      && (value = o(expr, staticKeypath))
      && is.object(value)
    ) {
      let absoluteKeypath = expr[ env.RAW_ABSOLUTE_KEYPATH ]
      object.each(
        value,
        function (value, key) {
          addAttr(key, value)
          if (isDef(staticKeypath)) {
            addDirective(
              config.DIRECTIVE_BINDING,
              key,
              absoluteKeypath
              ? absoluteKeypath + env.KEYPATH_SEPARATOR + key
              : key
            )
          }
        }
      )
    }
  },
  localPartials = { },
  // partial
  p = function (name, children) {
    localPartials[ name ] = children
  },
  // import
  i = function (name) {
    let lastElement = currentElement
    pushElement({ })
    if (localPartials[ name ]) {
      currentElement[ env.RAW_CHILDREN ] = [ ]
      localPartials[ name ]()
    }
    else {
      let partial = instance.importPartial(name)
      if (partial) {
        currentElement[ env.RAW_CHILDREN ] = partial.map(executeRender)
      }
    }
    if (currentElement[ env.RAW_CHILDREN ]) {
      let result = currentElement[ env.RAW_CHILDREN ]
      popElement(lastElement)
      return result
    }
    logger.fatal(`"${name}" partial is not found.`)
  },
  executeRender = function (render) {
    return render(a, b, c, e, i, m, o, p, s, x, y, z)
  }

  scope[ config.SPECIAL_KEYPATH ] = keypath

  return executeRender(render)

}
