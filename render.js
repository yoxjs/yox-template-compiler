
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
import stringifyExpression from 'yox-expression-compiler/stringify'
import * as expressionNodeType from 'yox-expression-compiler/src/nodeType'

import Context from './src/Context'
import * as helper from './src/helper'
import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

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

  let context = new Context(data, keypath), nodeStack = [ ], nodeList = [ ], binding = env.FALSE

  let pushStack = function (node) {
    if (is.array(node.context)) {
      executeFunction(
        context.set,
        context,
        node.context
      )
    }
    if (node.keypath !== env.UNDEFINED) {
      array.push(
        keypathList,
        node.keypath
      )
      updateKeypath()
    }
    if (node.value !== env.UNDEFINED) {
      context = context.push(
        node.value,
        keypath
      )
    }
    if (helper.htmlTypes[ node.type ]) {
      array.push(htmlStack, node.type)
    }
    array.push(
      nodeStack,
      {
        node,
        index: -1,
        parent: current,
      }
    )
    current = array.last(nodeStack)
  }

  let popStack = function () {
    let { node } = current
    if (helper.htmlTypes[ node.type ]) {
      array.pop(htmlStack)
    }
    if (node.value !== env.UNDEFINED) {
      context = context.pop()
    }
    if (node.keypath !== env.UNDEFINED) {
      array.pop(keypathList)
      updateKeypath()
    }
    if (sibling) {
      sibling = env.NULL
    }
    current = current.parent
    array.pop(nodeStack)
  }

  let pushNode = function (node) {
    if (is.array(node)) {
      if (node.length) {
        pushStack({
          children: node,
        })
      }
    }
    else {
      pushStack(node)
    }
  }

  let addValue = function (value) {
    let parent = current.parent, collection
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

  let executeExpr = function (expr) {
    return executeExpression(
      expr,
      context,
      function (keypath) {
        if (binding === env.TRUE) {
          binding = keypath
        }
      },
      function (key, value) {
        if (binding === env.FALSE) {
          addDep(key, value)
        }
      }
    )
  }

  let filterElse = function (node) {
    if (helper.elseTypes[ node.type ]) {
      return env.FALSE
    }
    else {
      filter = env.NULL
      return env.TRUE
    }
  }

  let enter = { }, leave = { }

  enter[ nodeType.PARTIAL ] = function (node) {
    partials[ node.name ] = node.children
    popStack()
    return env.FALSE
  }

  enter[ nodeType.IMPORT ] = function (node) {
    let { name } = node
    let partial = partials[ name ] || importTemplate(name)
    if (partial) {
      popStack()
      pushNode(partial)
      return env.FALSE
    }
    logger.fatal(`Partial "${name}" is not found.`)
  }

  // 条件判断失败就没必要往下走了
  // 但如果失败的点原本是一个 DOM 元素
  // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
  enter[ nodeType.IF ] =
  enter[ nodeType.ELSE_IF ] = function (node) {
    if (!executeExpr(node.expr)) {
      if (sibling
        && !helper.elseTypes[ sibling.type ]
        && !helper.attrTypes[ array.last(htmlStack) ]
      ) {
        addValue(
          makeNodes(
            createComment()
          )
        )
      }
      popStack()
      return env.FALSE
    }
  }

  enter[ nodeType.EACH ] = function (node) {

    popStack()

    let { expr, index, children } = node

    let value = executeExpr(expr), each

    if (is.array(value)) {
      each = array.each
    }
    else if (is.object(value)) {
      each = object.each
    }

    if (each) {

      let list = [ ]
      // push 之后 keypath 会更新
      // 这样 each 的 children 才能取到正确的 keypath
      pushStack({
        value,
        children: list,
        keypath: expr.keypath,
      })

      each(
        value,
        function (value, i, item) {

          item = {
            value,
            children,
            keypath: i,
          }

          if (index) {
            item.context = [ index, i ]
          }

          array.push(list, item)

        }
      )

    }

    return env.FALSE

  }

  enter[ nodeType.ATTRIBUTE ] = function (node) {
    let { children } = node
    if (children && children.length === 1) {
      binding = children[ 0 ].bindable || env.FALSE
    }
  }

  let createAttribute = function (name, value, binding) {
    let attribute = {
      name,
      value,
      keypath,
      type: nodeType.ATTRIBUTE,
    }
    if (is.string(binding)) {
      attribute.binding = binding
    }
    return attribute
  }

  leave[ nodeType.TEXT ] = function (node) {
    return node.content
  }

  leave[ nodeType.EXPRESSION ] = function (node) {
    return executeExpr(node.expr)
  }

  leave[ nodeType.ATTRIBUTE ] = function (node) {
    node = createAttribute(
      node.name,
      mergeNodes(current.children, node.children),
      binding
    )
    binding = env.FALSE
    return node
  }

  leave[ nodeType.DIRECTIVE ] = function (node) {
    let { name } = node
    let value = mergeNodes(current.children, node.children)
    let result = context.get(keypath)

    if (name === syntax.KEYWORD_UNIQUE) {
      if (value != env.NULL) {
        if (!currentCache) {
          prevCache = ast.cache
          currentCache = ast.cache = { }
        }
        cache = prevCache && prevCache[ value ]
        if (cache && cache.value === result.value) {
          currentCache[ value ] = cache
          // 回退到元素层级
          while (current.node.type !== nodeType.ELEMENT) {
            popStack()
          }
          addDep(result.keypath, result.value)
          return cache.result
        }
        else {
          // 缓存挂在元素上
          while (node = current.parent) {
            if (node.node.type === nodeType.ELEMENT) {
              node.cache = {
                key: value,
                value: result.value,
              }
              break
            }
          }
        }
      }
      return
    }

    return {
      name,
      value,
      keypath,
      modifier: node.modifier,
      context: result.value,
      type: nodeType.DIRECTIVE,
    }
  }

  leave[ nodeType.IF ] =
  leave[ nodeType.ELSE_IF ] =
  leave[ nodeType.ELSE ] = function (node) {
    filter = filterElse
    return current.children
  }

  leave[ nodeType.SPREAD ] = function (node) {
    binding = env.TRUE
    let value = executeExpr(node.expr), list = makeNodes([ ])
    if (is.object(value)) {
      let hasBinding = is.string(binding)
      object.each(
        value,
        function (value, name) {
          array.push(
            list,
            createAttribute(
              name,
              value,
              hasBinding ? keypathUtil.join(binding, name) : env.UNDEFINED
            )
          )
        }
      )
    }
    else {
      logger.fatal(`Spread "${stringifyExpression(node.expr)}" must be an object.`)
    }
    binding = env.FALSE
    return list
  }

  leave[ nodeType.ELEMENT ] = function (node) {

    let attributes = [ ], directives = [ ], children = [ ]

    if (current.children) {
      array.each(
        current.children,
        function (node) {
          if (node.type === nodeType.ATTRIBUTE) {
            array.push(attributes, node)
          }
          else if (node.type === nodeType.DIRECTIVE) {
            array.push(directives, node)
          }
          else {
            array.push(children, node)
          }
        }
      )
    }

    return createElement(
      {
        name: node.name,
        key: current.cache ? current.cache.key : env.UNDEFINED,
        component: node.component,
        keypath,
        attributes,
        directives,
        children,
      },
      node
    )
  }

  leave[ env.UNDEFINED ] = function (node, current) {
    return current.children
  }

  let traverseList = function (current, list, item) {
    while (item = list[ ++current.index ]) {
      if (!filter || filter(item)) {
        sibling = list[ current.index + 1 ]
        pushStack(item)
        return env.FALSE
      }
    }
  }


  // 当前处理的栈节点
  let current,
  // 相邻节点
  sibling,
  // 过滤某些节点的函数
  filter,
  // 节点的值
  value,
  // 缓存
  cache,
  prevCache,
  currentCache,
  // 正在渲染的 html 层级
  htmlStack = [ ],
  // 用时定义的模板片段
  partials = { }

  pushNode(ast)

  while (nodeStack.length) {

    let { node } = current
    let { type, attrs, children } = node

    if (!current.enter) {
      current.enter = env.TRUE

      if (
        executeFunction(
          enter[ type ],
          env.NULL,
          [ node, current ]
        ) === env.FALSE
      ) {
        continue
      }

    }

    if (attrs && !current.attrs) {
      if (traverseList(current, attrs) === env.FALSE) {
        continue
      }
      current.index = -1
      current.attrs = env.TRUE
    }

    if (children && traverseList(current, children) === env.FALSE) {
      continue
    }

    value = executeFunction(
      leave[ type ],
      env.NULL,
      [ node, current ]
    )

    if (value !== env.UNDEFINED) {
      addValue(value)
      cache = current.cache
      if (cache) {
        cache.result = value
        currentCache[ cache.key ] = cache
      }
    }

    popStack()

  }

  return nodeList

}
