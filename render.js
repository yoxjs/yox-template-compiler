
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

  let keypathList = [ ],
  getKeypath = function () {
    return keypathUtil.stringify(keypathList)
  },
  keypath = getKeypath()

  getKeypath.toString = getKeypath


  data[ syntax.SPECIAL_KEYPATH ] = keypath
  let context = new Context(data, keypath)

  // 渲染模板收集的依赖
  let deps = { }

  let executeExpr = function (expr) {
    let result = executeExpression(expr, context)
    object.extend(deps, result.deps)
    return result.value
  }

  let getUnescapedProps = function (type, children) {
    if (type === nodeType.ELEMENT && children.length === 1) {
      let child = children[ 0 ]
      if (child.type === nodeType.EXPRESSION
        && child.safe === env.FALSE
      ) {
        return {
          innerHTML: executeExpr(child.expr)
        }
      }
    }
  }

  let traverseNode = function (node) {

    let nodeStack = [ ]

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
      }
      if (object.has(node, 'forward')) {
        context = context.push(
          node.forward,
          getKeypath()
        )
      }
      array.push(
        nodeStack,
        {
          node,
          index: -1,
          result: makeNodes([ ]),
        }
      )
    }

    let popStack = function () {
      let { node } = array.pop(nodeStack)
      if (object.has(node, 'forward')) {
        context = context.pop()
      }
      if (object.has(node, 'keypath')) {
        array.pop(keypathList)
      }
      if (filter) {
        filter = env.NULL
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

    let value,
    // 当前处理的栈节点
    current,
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

      let { node, index, props } = current
      let { type, name, expr, modifier, component, content, attrs, children } = node

      let addValue = function (value) {
        if (value !== env.UNDEFINED) {
          if (isNodes(value)) {
            array.push(result, value)
          }
          else {
            result.push(value)
          }
        }
      }

      // 检查是否有必要处理这个节点
      // 如果没有必要，需拦截后面的逻辑
      // ================ enter start ==================
      switch (type) {

        // 用时定义的子模板无需注册到组件实例
        case nodeType.PARTIAL:
          // 注册即可，无需往下走了
          partials[ name ] = children
          popStack()
          continue

        // 导入子模板
        case nodeType.IMPORT:
          // 用时定义的子模板优先
          content = partials[ name ] || importTemplate(name)
          if (content) {
            popStack()
            pushNode(content)
            continue
          }
          logger.fatal(`Partial "${name}" is not found.`)

        // 条件判断失败就没必要往下走了
        // 但如果失败的点原本是一个 DOM 元素
        // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
        case nodeType.IF:
        case nodeType.ELSE_IF:
          if (executeExpr(expr)) {
            break
          }
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
          continue

        // 循环
        case nodeType.EACH:
          value = executeExpr(expr)

          if (is.array(value)) {
            name = array.each
          }
          else if (is.object(value)) {
            name = object.each
          }
          else {
            popStack()
            continue
          }

          content = children
          children = [ ]

          name(
            value,
            function (forward, index, node) {

              node = {
                children: content,
                keypath: index,
                forward,
              }

              if (node.index) {
                node.context = [ node.index, index ]
              }

              array.push(children, node)

            }
          )

          pushStack({
            children,
            keypath: keypathUtil.normalize(
              stringifyExpression(expr)
            ),
            forward: value,
          })

          continue

      }

      // 记录 html 层级
      // 方便判断当前处于元素层级还是属性层级
      if (helper.htmlTypes[ type ]) {
        array.push(htmlStack, type)
      }
      // ================ enter end ==================


      if (children) {

        props = getUnescapedProps(type, children)
        if (props) {
          children = env.NULL
        }
        else {
          // 依次遍历 children
          while (node = children[ ++index ]) {
            if (!filter || filter(node)) {
              current.index = index
              sibling = children[ index + 1 ]
              pushStack(node)
              break
            }
          }
          if (array.last(nodeStack) !== current) {
            continue
          }
        }

      }


      // ==================== leave start =====================
      if (helper.htmlTypes[ type ]) {
        array.pop(htmlStack)
      }

      switch (type) {
        case nodeType.TEXT:
          addValue(content)
          break


        case nodeType.EXPRESSION:
          addValue(
            executeExpr(expr)
          )
          break


        case nodeType.ATTRIBUTE:
          addValue({
            name,
            keypath: getKeypath(),
            value: mergeNodes(children),
          })
          break


        case nodeType.DIRECTIVE:
          addValue({
            name,
            modifier,
            keypath: getKeypath(),
            value: mergeNodes(children),
          })
          break


        case nodeType.IF:
        case nodeType.ELSE_IF:
        case nodeType.ELSE:
          // 如果是空，也得是个空数组
          addValue(
            is.array(children) ? children : makeNodes([ ])
          )
          // 跳过后面紧跟着的 else if / else
          filter = function (node) {
            if (helper.elseTypes[ node.type ]) {
              return env.FALSE
            }
            else {
              filter = env.NULL
              return env.TRUE
            }
          }
          break


        case nodeType.SPREAD:
          value = executeExpr(expr)
          if (is.object(value)) {
            children = [ ]
            keypath = getKeypath()
            object.each(
              value,
              function (value, name) {
                array.push(
                  children,
                  {
                    name,
                    value,
                    keypath,
                  }
                )
              }
            )
            addValue(
              makeNodes(children)
            )
            break
          }
          logger.fatal(`Spread "${stringifyExpression(expr)}" must be an object.`)


        case nodeType.ELEMENT:
          let attributes = [ ], directives = [ ]
          if (attrs) {
            array.each(
              traverseNode(attrs),
              function (node) {
                if (object.has(node, 'modifier')) {
                  if (node.name && node.modifier !== char.CHAR_BLANK) {
                    array.push(directives, node)
                  }
                }
                else {
                  array.push(attributes, node)
                }
              }
            )
          }
          addValue(
            createElement(
              {
                name,
                keypath: getKeypath(),
                attributes,
                directives,
                properties: props || { },
                children: children || [ ],
              },
              component
            )
          )
          break

      }
      // ==================== leave end =====================

      popStack()

    }

    return current ? current.result : [ ]

  }

  return {
    nodes: traverseNode(ast),
    deps,
  }

}
