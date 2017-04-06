
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

import executeExpression from 'yox-expression-compiler/execute'

import Context from './src/Context'
import * as helper from './src/helper'
import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

import compile from './compile'

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
 * @return {Object} { node: x, deps: { } }
 */
export default function render(ast, createComment, createElement, importTemplate, data) {

  let keypaths = [ ]
  let getKeypath = function () {
    return keypathUtil.stringify(keypaths)
  }
  getKeypath.toString = getKeypath

  data[ syntax.SPECIAL_KEYPATH ] = getKeypath
  let context = new Context(data)

  // 正在渲染的 html 层级
  let htmlStack = [ ]

  // 用时定义的模板片段
  let partials = { }

  let deps = { }
  let executeExpr = function (expr) {
    let { value, deps } = executeExpression(expr, context)
    object.each(
      deps,
      function (value, key) {
        deps[ keypathUtil.resolve(getKeypath(), key) ] = value
      }
    )
    return value
  }

  /**
   * 遍历节点树
   *
   * @param {Node} node
   * @param {Function} enter
   * @param {Function} leave
   * @return {*}
   */
  let traverseTree = function (node, enter, leave) {

    let value = enter(node)
    if (value !== env.FALSE) {
      if (value === env.UNDEFINED) {
        let { children, attrs } = node
        let props = { }

        if (children) {
          if (node.type === nodeType.ELEMENT && children.length === 1) {
            let child = children[ 0 ]
            if (child.type === nodeType.EXPRESSION
              && child.safe === env.FALSE
            ) {
              props.innerHTML = executeExpr(child.expr)
              children = env.NULL
            }
          }
          if (children) {
            children = traverseList(children)
          }
        }

        if (attrs) {
          attrs = traverseList(attrs)
        }

        value = leave(node, children, attrs, props)
      }
      return value
    }

  }

  /**
   * 遍历节点列表
   *
   * @param {Array.<Node>} nodes
   * @return {Array}
   */
  let traverseList = function (nodes) {
    let list = [ ], i = 0, node, value
    while (node = nodes[ i ]) {
      value = recursion(node, nodes[ i + 1 ])
      if (value !== env.UNDEFINED) {
        if (isNodes(value)) {
          array.push(list, value)
        }
        else {
          list.push(value)
        }
        if (helper.ifTypes[ node.type ]) {
          // 跳过后面紧跟着的 elseif else
          while (node = nodes[ i + 1 ]) {
            if (helper.elseTypes[ node.type ]) {
              i++
            }
            else {
              break
            }
          }
        }
      }
      i++
    }
    return makeNodes(list)
  }

  let recursion = function (node, nextNode) {
    return traverseTree(
      node,
      function (node) {

        let { type, name, expr } = node

        switch (type) {

          // 用时定义的子模块无需注册到组件实例
          case nodeType.PARTIAL:
            partials[ name ] = node
            return env.FALSE

          case nodeType.IMPORT:
            let partial = partials[ name ] || importTemplate(name)
            if (partial) {
              if (is.string(partial)) {
                partial = compile(partial)
              }
              else if (partial.type === nodeType.PARTIAL) {
                partial = partial.children
              }
              return is.array(partial)
                ? traverseList(partial)
                : recursion(partial)
            }
            break

          // 条件判断失败就没必要往下走了
          // 但如果失败的点原本是一个 DOM 元素
          // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
          case nodeType.IF:
          case nodeType.ELSE_IF:
            if (!executeExpr(expr)) {
              name = array.last(htmlStack)
              return name === nodeType.ATTRIBUTE
                || name === nodeType.DIRECTIVE
                || !nextNode
                || helper.elseTypes[ nextNode.type ]
                  ? env.FALSE
                  : makeNodes(createComment())
            }
            break

          case nodeType.EACH:
            let { index, children } = node
            let value = executeExpr(expr)

            let iterate
            if (is.array(value)) {
              iterate = array.each
            }
            else if (is.object(value)) {
              iterate = object.each
            }
            else {
              return env.FALSE
            }

            let list = [ ]

            array.push(
              keypaths,
              keypathUtil.normalize(
                expressionEnginer.stringify(expr)
              )
            )
            context = context.push(value)

            iterate(
              value,
              function (item, i) {
                if (index) {
                  context.set(index, i)
                }

                array.push(keypaths, i)
                context = context.push(item)

                array.push(
                  list,
                  traverseList(children)
                )

                array.pop(keypaths)
                context = array.pop(context)

              }
            )

            array.pop(keypaths)
            context = array.pop(context)

            return makeNodes(list)

        }

        if (helper.htmlTypes[ type ]) {
          array.push(htmlStack, type)
        }

      },
      function (node, children, attrs, props) {

        let { type, name, modifier, component, content } = node
        let keypath = getKeypath()

        if (helper.htmlTypes[ type ]) {
          array.pop(htmlStack)
        }

        switch (type) {
          case nodeType.TEXT:
            return content


          case nodeType.EXPRESSION:
            return executeExpr(node.expr)


          case nodeType.ATTRIBUTE:
            return {
              name,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.DIRECTIVE:
            return {
              name,
              modifier,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.IF:
          case nodeType.ELSE_IF:
          case nodeType.ELSE:
            // 如果是空，也得是个空数组
            return is.array(children)
              ? children
              : makeNodes([ ])


          case nodeType.SPREAD:
            content = executeExpr(node.expr)
            if (is.object(content)) {
              let list = [ ]
              object.each(
                content,
                function (value, name) {
                  array.push(
                    list,
                    {
                      name,
                      value,
                      keypath,
                    }
                  )
                }
              )
              return makeNodes(list)
            }
            break


          case nodeType.ELEMENT:
            let attributes = [ ], directives = [ ]
            if (attrs) {
              array.each(
                attrs,
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
            return createElement(
              {
                name,
                keypath,
                attributes,
                directives,
                properties: props,
                children: children || [ ],
              },
              component
            )
        }

      }
    )
  }

  return {
    node: recursion(ast),
    deps,
  }

}
