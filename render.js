
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
 * @param {?Array} nodes
 * @return {*}
 */
function mergeNodes(nodes) {
  if (is.array(nodes)) {
    switch (nodes.length) {
      // name=""
      case 0:
        return char.CHAR_BLANK
      // name="{{value}}"
      case 1:
        return nodes[ 0 ]
      // name="{{value1}}{{value2}}"
      default:
        return nodes.join(char.CHAR_BLANK)
    }
  }
}

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Function} createComment 创建注释节点
 * @param {Function} createElement 创建元素节点
 * @param {Function} importTemplate 导入子模板，如果是纯模板，可不传
 * @param {Object} data 渲染模板的数据，如果渲染纯模板，可不传
 * @return {Object} { nodes: x, deps: { } }
 */
export default function render(ast, createComment, createElement, importTemplate, data) {

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

  let context = new Context(data, keypath)

  // 渲染模板收集的依赖
  let deps = { }

  let executeExpr = function (expr) {
    let result = executeExpression(expr, context)
    object.extend(deps, result.deps)
    return result.value
  }

  let traverseNode = function (node) {

    let nodeStack = [ ], result = [ ]

    let pushStack = function (node) {
      if (object.has(node, 'context')) {
        executeFunction(
          context.set,
          context,
          node.context
        )
      }
      if (object.has(node, 'keypath')) {
        array.push(
          keypathList,
          node.keypath
        )
        updateKeypath()
      }
      if (object.has(node, 'data')) {
        context = context.push(
          node.data,
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
          children: makeNodes([ ]),
        }
      )
    }

    let popStack = function () {
      let { node } = array.pop(nodeStack)
      if (helper.htmlTypes[ node.type ]) {
        array.pop(htmlStack)
      }
      if (object.has(node, 'data')) {
        context = context.pop()
      }
      if (object.has(node, 'keypath')) {
        array.pop(keypathList)
        updateKeypath()
      }
      if (sibling) {
        sibling = env.NULL
      }
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
      if (value !== env.UNDEFINED) {
        let node = nodeStack[ nodeStack.length - 2 ]
        let collection = node ? node.children : result
        if (isNodes(value)) {
          array.push(collection, value)
        }
        else {
          collection.push(value)
        }
      }
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

      let value = executeExpr(node.expr), list = [ ], each

      if (is.array(value)) {
        each = array.each
      }
      else if (is.object(value)) {
        each = object.each
      }

      if (each) {
        each(
          value,
          function (data, i, item) {

            item = {
              data,
              keypath: i,
              children: node.children,
            }

            if (node.index) {
              item.context = [ node.index, i ]
            }

            array.push(list, item)

          }
        )

        pushStack({
          children: list,
          keypath: keypathUtil.normalize(
            stringifyExpression(node.expr)
          ),
          data: value,
        })
      }

      return env.FALSE

    }


    leave[ nodeType.TEXT ] = function (node) {
      addValue(
        node.content
      )
    }

    leave[ nodeType.EXPRESSION ] = function (node) {
      addValue(
        executeExpr(node.expr)
      )
    }

    leave[ nodeType.ATTRIBUTE ] = function (node, current) {
      addValue({
        keypath,
        type: nodeType.ATTRIBUTE,
        name: node.name,
        value: mergeNodes(current.children),
      })
    }

    leave[ nodeType.DIRECTIVE ] = function (node, current) {
      addValue({
        keypath,
        name: node.name,
        type: nodeType.DIRECTIVE,
        modifier: node.modifier,
        value: mergeNodes(current.children),
      })
    }

    leave[ nodeType.IF ] =
    leave[ nodeType.ELSE_IF ] =
    leave[ nodeType.ELSE ] = function (node, current) {
      addValue(
        current.children
      )
      filter = filterElse
    }

    leave[ nodeType.SPREAD ] = function (node) {
      let value = executeExpr(node.expr)
      if (is.object(value)) {
        object.each(
          value,
          function (value, name) {
            addValue({
              name,
              value,
              keypath,
              type: nodeType.ATTRIBUTE,
            })
          }
        )
        return
      }
      logger.fatal(`Spread "${stringifyExpression(node.expr)}" must be an object.`)
    }

    leave[ nodeType.ELEMENT ] = function (node, current) {

      let attributes = [ ], directives = [ ], children = [ ], properties, child

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

      let nodeChildren = node.children
      if (nodeChildren && nodeChildren.length === 1) {
        child = nodeChildren[ 0 ]
        if (child.type === nodeType.EXPRESSION
          && child.safe === env.FALSE
        ) {
          properties = {
            innerHTML: children[ 0 ],
          }
          children.length = 0
        }
      }

      addValue(
        createElement(
          {
            name: node.name,
            keypath,
            attributes,
            directives,
            properties,
            children,
          },
          node.component
        )
      )
    }

    leave[ env.UNDEFINED ] = function (node, current) {
      addValue(
        current.children
      )
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
    // 过滤某些节点的函数
    filter,
    // 相邻节点
    sibling,
    // 正在渲染的 html 层级
    htmlStack = [ ],
    // 用时定义的模板片段
    partials = { }

    pushNode(node)


    while (nodeStack.length) {

      current = array.last(nodeStack)

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

      executeFunction(
        leave[ type ],
        env.NULL,
        [ node, current ]
      )

      popStack()

    }

    return result

  }

  return {
    nodes: traverseNode(ast),
    deps,
  }

}
