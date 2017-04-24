
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import executeFunction from 'yox-common/function/execute'
import executeExpression from 'yox-expression-compiler/execute'
import * as expressionNodeType from 'yox-expression-compiler/src/nodeType'

import Context from './src/Context'
import * as helper from './src/helper'
import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

import Text from './src/node/Text'

/**
 * 标记节点数组，用于区分普通数组
 *
 * @param {*} nodes
 * @return {*}
 */
function makeNodes(nodes) {
  if (is.array(nodes)) {
    nodes[ char.CHAR_DASH ] = env.TRUE
  }
  return nodes
}

/**
 * 是否是节点数组
 *
 * @param {*} nodes
 * @return {boolean}
 */
function isNodes(nodes) {
  return is.array(nodes) && nodes[ char.CHAR_DASH ]
}

/**
 * 合并多个节点
 *
 * 用于处理属性值和指令值
 *
 * @param {?Array} outputNodes
 * @param {?Array} sourceNodes
 * @return {*}
 */
function mergeNodes(outputNodes, sourceNodes) {
  if (is.array(outputNodes)) {
    switch (outputNodes.length) {
      // name=""
      case 0:
        return char.CHAR_BLANK
      // name="{{value}}"
      case 1:
        return outputNodes[ 0 ]
      // name="{{value1}}{{value2}}"
      default:
        return outputNodes.join(char.CHAR_BLANK)
    }
  }
  else if (!array.falsy(sourceNodes)) {
    return char.CHAR_BLANK
  }
}

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Function} createComment 创建注释节点
 * @param {Function} createElement 创建元素节点
 * @param {?Function} importTemplate 导入子模板，如果是纯模板，可不传
 * @param {?Function} addDep 渲染模板过程中使用的数据依赖，如果是纯模板，可不传
 * @param {Object} data 渲染模板的数据，如果渲染纯模板，可不传
 * @return {Array}
 */
export default function render(ast, createComment, createElement, importTemplate, addDep, data) {

  let keypath, keypathList = [ ],
  updateKeypath = function () {
    keypath = keypathUtil.stringify(keypathList)
  },
  getKeypath = function () {
    return keypath
  }

  updateKeypath()

  getKeypath.toString = getKeypath
  data[ syntax.SPECIAL_KEYPATH ] = getKeypath

  let context = new Context(data, keypath), nodeStack = [ ], nodeList = [ ], htmlStack = [ ], partials = { }

  let sibling, cache, prevCache, currentCache

  let isDefined = function (value) {
    return value !== env.UNDEFINED
  }

  let traverseList = function (list) {
    array.each(
      list,
      function (node, index) {
        if (!filterNode || filterNode(node)) {
          sibling = list[ index + 1 ]
          pushStack(node)
        }
      }
    )
  }

  let addChild = function (value, parent) {
    let collection
    if (parent) {
      collection = parent.children || (parent.children = makeNodes([ ]))
    }
    else {
      collection = nodeList
    }
    if (isNodes(value)) {
      array.push(collection, value)
    }
    else {
      collection.push(value)
    }
  }

  let addAttr = function (key, value, parent) {
    let attrs = parent.attrs || (parent.attrs = { })
    attrs[ key ] = value
  }

  let addDirective = function (directive, parent) {
    let directives = parent.directives || (parent.directives = { })
    directives[ keypathUtil.join(directive.name, directive.modifier) ] = directive
  }

  let attributeRendering
  let pushStack = function (source, silent) {

    let { type, attrs, children } = source

    let parent = array.last(nodeStack), output = { type, source, parent }

    let value = executeFunction(
      enter[ type ],
      env.NULL,
      [ source, output ]
    )

    if (isDefined(value)) {
      if (!silent && value !== env.FALSE) {
        addChild(value, parent)
      }
      return value
    }

    if (isDefined(source.keypath)) {
      array.push(
        keypathList,
        source.keypath
      )
      updateKeypath()
    }
    if (isDefined(source.value)) {
      context = context.push(
        source.value,
        keypath
      )
    }
    if (is.array(source.context)) {
      executeFunction(
        context.set,
        context,
        source.context
      )
    }

    array.push(nodeStack, output)

    if (helper.htmlTypes[ type ]) {
      array.push(htmlStack, output)
    }

    if (attrs) {
      attributeRendering = env.TRUE
      traverseList(attrs)
      attributeRendering = env.NULL
    }

    if (children) {
      traverseList(children)
    }

    value = executeFunction(
      leave[ type ],
      env.NULL,
      [ source, output ]
    )

    if (!silent && isDefined(value)) {
      addChild(value, parent)
    }

    array.pop(nodeStack)

    if (helper.htmlTypes[ source.type ]) {
      array.pop(htmlStack)
    }

    if (isDefined(source.value)) {
      context = context.pop()
    }
    if (isDefined(source.keypath)) {
      array.pop(keypathList)
      updateKeypath()
    }

    return value

  }

  let pushNode = function (node, silent) {
    if (is.array(node)) {
      node = {
        children: node,
      }
    }
    return pushStack(node, silent)
  }

  let createDirective = function (name, modifier, value, expr) {
    return {
      name,
      modifier,
      context,
      keypath,
      value,
      expr,
    }
  }

  let filterNode
  let filterElse = function (node) {
    if (helper.elseTypes[ node.type ]) {
      return env.FALSE
    }
    else {
      filterNode = env.NULL
      return env.TRUE
    }
  }

  let addExpressionDep = addDep
  let executeExpr = function (expr) {
    return executeExpression(expr, context, addExpressionDep)
  }

  let enter = { }, leave = { }

  enter[ nodeType.PARTIAL ] = function (source) {
    partials[ source.name ] = source.children
    return env.FALSE
  }

  enter[ nodeType.IMPORT ] = function (source) {
    let { name } = source
    let partial = partials[ name ] || importTemplate(name)
    if (partial) {
      pushNode(partial)
      return env.FALSE
    }
    logger.fatal(`Partial "${name}" is not found.`)
  }

  // 条件判断失败就没必要往下走了
  // 但如果失败的点原本是一个 DOM 元素
  // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
  enter[ nodeType.IF ] =
  enter[ nodeType.ELSE_IF ] = function (source) {
    if (!executeExpr(source.expr)) {
      if (sibling
        && !helper.elseTypes[ sibling.type ]
        && !attributeRendering
      ) {
        return makeNodes(createComment())
      }
      return env.FALSE
    }
  }

  leave[ nodeType.IF ] =
  leave[ nodeType.ELSE_IF ] =
  leave[ nodeType.ELSE ] = function (source, output) {
    filterNode = filterElse
    return output.children
  }

  enter[ nodeType.EACH ] = function (source) {

    let { expr, index, children } = source
    let value = executeExpr(expr), each

    if (is.array(value)) {
      each = array.each
    }
    else if (is.object(value)) {
      each = object.each
    }

    if (each) {

      let list = [ ]

      each(
        value,
        function (value, i) {

          let child = {
            value,
            children,
            keypath: i,
          }

          if (index) {
            child.context = [ index, i ]
          }

          array.push(list, child)

        }
      )

      pushStack({
        value,
        children: list,
        keypath: expr.keypath,
      })

    }

    return env.FALSE

  }

  enter[ nodeType.ELEMENT ] = function (source, output) {
    let { key } = source
    if (key) {
      let trackBy
      if (is.string(key)) {
        trackBy = key
      }
      else if (is.array(key)) {
        attributeRendering = env.TRUE
        trackBy = mergeNodes(pushNode(key, env.TRUE), key)
        attributeRendering = env.NULL
      }
      if (trackBy) {

        if (!currentCache) {
          prevCache = ast.cache || { }
          currentCache = ast.cache = { }
        }

        let cache = prevCache[ trackBy ]
        let result = context.get(keypath)

        // 有缓存，且数据没有变化才算命中
        if (cache && cache.value === result.value) {
          currentCache[ trackBy ] = cache
          addDep(result.keypath, result.value)
          return cache.result
        }
        else {
          output.key = trackBy
          currentCache[ trackBy ] = {
            value: result.value,
          }
        }

      }
    }
    output.name = source.name
    output.component = source.component
  }

  leave[ nodeType.ELEMENT ] = function (source, output) {

    let value = createElement(source, output)

    let { key } = output
    if (key) {
      currentCache[ key ].result = value
    }

    return value

  }

  enter[ nodeType.ATTRIBUTE ] = function (source) {
    let { name, children, bindTo } = source
    if (is.string(bindTo)) {
      addExpressionDep = env.noop
    }
  }

  leave[ nodeType.ATTRIBUTE ] = function (source, output) {
    let element = htmlStack[ htmlStack.length - 2 ]
    let { name, children, bindTo } = source
    addAttr(
      name,
      mergeNodes(output.children, children),
      element,
    )
    if (is.string(bindTo)) {
      addDirective(
        createDirective(
          syntax.DIRECTIVE_MODEL,
          name,
          bindTo
        ),
        element
      )
      addExpressionDep = addDep
    }
  }



  leave[ nodeType.TEXT ] = function (source) {
    // 如果是元素的文本，而不是属性的文本
    // 直接保持原样，因为 snabbdom 文本节点的结构和模板文本节点结构是一致的
    return attributeRendering
      ? source.text
      : source
  }

  leave[ nodeType.EXPRESSION ] = function (source) {
    let text = executeExpr(source.expr)
    return attributeRendering
      ? text
      : new Text(text)
  }

  leave[ nodeType.DIRECTIVE ] = function (source, output) {

    // 1.如果指令的值是纯文本，会在编译阶段转成表达式抽象语法树
    //   on-click="submit()"
    //   ref="child"
    //
    // 2.如果指令的值包含插值语法，则会 merge 出最终值
    //   on-click="haha{{name}}"
    //
    // model="xxx"
    // model=""
    //
    let { name, modifier, expr, value } = source
    if (output.children) {
      value = mergeNodes(output.children, source.children)
    }

    addDirective(
      createDirective(name, modifier, value, expr),
      htmlStack[ htmlStack.length - 2 ]
    )

  }

  leave[ nodeType.SPREAD ] = function (source, output) {

    // 1. <Component {{...props}} />
    //    把 props.xx 当做单向绑定指令，无需收集依赖
    //
    // 2. <Component {{... a ? aProps : bProps }}/>
    //    复杂的表达式，需要收集依赖
    //

    let expr = source.expr, hasKeypath = is.string(expr.keypath), value
    if (hasKeypath) {
      addExpressionDep = env.noop
      value = executeExpr(expr)
      addExpressionDep = addDep
    }
    else {
      value = executeExpr(expr)
    }

    if (is.object(value)) {
      let element = array.last(htmlStack)
      object.each(
        value,
        function (value, name) {

          if (hasKeypath) {
            addDirective(
              createDirective(
                syntax.DIRECTIVE_MODEL,
                name,
                keypathUtil.join(expr.keypath, name)
              ),
              element
            )
          }
          else {
            addAttr(
              name,
              value,
              element
            )
          }

        }
      )
    }
    else {
      logger.fatal(`Spread "${expr.source}" must be an object.`)
    }

  }

  leave[ env.UNDEFINED ] = function (source, output) {
    return output.children
  }

  pushNode(ast)

  return nodeList

}
