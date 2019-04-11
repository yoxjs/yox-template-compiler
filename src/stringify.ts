import isDef from 'yox-common/function/isDef'
import toJSON from 'yox-common/function/toJSON'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

import * as config from 'yox-config'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'
import * as helper from './helper'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionLiteral from 'yox-expression-compiler/src/node/Literal'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'

import Node from './node/Node'
import Text from './node/Text'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Expression from './node/Expression'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Pair from './node/Pair'

/**
 * 序列化有两个难点：
 *
 * 1. 区分函数名和正常字符串的序列化
 * 2. 区分 node 数组和数据数组
 *
 */

const FUNC_ELEMENT = '_c'
const FUNC_COMMENT = '_m'
const FUNC_EMPTY = '_n'
const FUNC_EXPR = '_e'
const FUNC_RENDER = '_r'

const SEP_COMMA = ', '
const SEP_PLUS = ' + '

function stringifyObject(obj: Object): string | void {
  const fields = []
  object.each(
    obj,
    function (value: any, key: string) {
      if (isDef(value)) {
        array.push(
          fields,
          `${toJSON(key)}: ${value}`
        )
      }
    }
  )
  if (fields.length) {
    return `{ ${array.join(fields, SEP_COMMA)} }`
  }
}

function stringifyArray(arr: any[]): string | void {
  if (arr.length) {
    return `[ ${array.join(arr, SEP_COMMA)} ]`
  }
}

function stringifyCall(name: string, arg: string): string {
  return `${name}(${arg})`
}

function stringifyExpression(expr: ExpressionNode): string {
  return expr.type === exprNodeType.IDENTIFIER
    ? stringifyCall(FUNC_EXPR, toJSON((expr as ExpressionIdentifier).name))
    : expr.type === exprNodeType.LITERAL
      ? toJSON((expr as ExpressionLiteral).value)
      : stringifyCall(FUNC_EXPR, toJSON(expr))
}

function stringifyEmpty(): string {
  return stringifyCall(FUNC_EMPTY, char.CHAR_BLANK)
}

function stringifyComment(): string {
  return stringifyCall(FUNC_COMMENT, char.CHAR_BLANK)
}

function stringifyEvent(expr: ExpressionNode): any {
  if (expr.type === exprNodeType.IDENTIFIER) {
    return stringifyObject({
      event: toJSON((expr as ExpressionIdentifier).name)
    })
  }
  else if (expr.type === exprNodeType.CALL) {
    const { callee, args } = expr as ExpressionCall
    if (callee.type === exprNodeType.IDENTIFIER) {
      return stringifyObject({
        method: toJSON((callee as ExpressionIdentifier).name),
        args: args.length > 0
          ? toJSON(args)
          : env.UNDEFINED,
      })
    }
  }
}

function stringifyDirective(value: string | undefined, expr: ExpressionNode | undefined): string | void {
  return stringifyObject({
    value: toJSON(value),
    expr: toJSON(expr),
  })
}

function stringifyValue(value: any, expr: ExpressionNode | void, children: Node[] | void): string | void {
  return isDef(value)
    ? toJSON(value)
    : expr
      ? stringifyExpression(expr)
      : stringifyChildren(children)
}

function stringifyChildren(children: Node[] | void, outputArray?: boolean): string | void {
  if (children && children.length) {
    // 如果 children 只包含简单子节点，则用 + 连起来提升运行时性能
    let childs = [], hasComplexChild = env.FALSE
    array.each(
      children,
      function (child: Node) {
        if (!hasComplexChild
          && !helper.simpleChildTypes[child.type]
        ) {
          hasComplexChild = env.TRUE
        }
        array.push(childs, stringify(child))
      }
    )
    const value = array.join(childs, hasComplexChild ? SEP_COMMA : SEP_PLUS)
    return outputArray
      ? `[ ${value} ]`
      : hasComplexChild
        ? stringifyCall(FUNC_RENDER, value)
        : value
  }
}

function stringifyComponentData(attrs: (Attribute | Spread)[] | void, props: Pair[] | void): string | void {

  const data: any = {
    component: env.TRUE,
  },

  // 比如 <Custom {{...obj1}} {{...obj2}}/>
  // 用对象有两个问题，第一是延展操作不好写 key，第二是无法保证顺序
  componentProps = [],

  componentOn = {},

  componentDirectives = {},

  addAttr = function (attr: Attribute) {
    if (attr.directive) {
      if (attr.expr && attr.namespace === config.DIRECTIVE_EVENT) {
        componentOn[attr.name] = stringifyEvent(attr.expr)
      }
      else {
        componentDirectives[attr.name] = stringifyDirective(attr.value, attr.expr)
      }
    }
    else {
      array.push(
        componentProps,
        stringifyObject({
          name: toJSON(attr.name),
          value: stringifyValue(attr.value, attr.expr, attr.children),
        })
      )
    }
  },

  addSpread = function (spread: Spread) {
    array.push(
      componentProps,
      stringifyObject({
        spread: stringifyExpression(spread.expr)
      })
    )
  }

  if (attrs) {
    array.each(
      attrs,
      function (attr: Attribute | Spread) {
        if (attr.type === nodeType.ATTRIBUTE) {
          addAttr(attr as Attribute)
        }
        else {
          addSpread(attr as Spread)
        }
      }
    )
  }

  // 目前只可能存在两个属性：text 和 html
  if (props) {
    array.each(
      props,
      function (prop: Pair) {
        array.push(
          componentProps,
          stringifyObject({
            name: toJSON(prop.name),
            value: stringifyValue(prop.value, prop.expr),
          })
        )
      }
    )
  }

  if (componentProps.length) {
    data.props = stringifyArray(componentProps)
  }

  if (!object.empty(componentOn)) {
    data.on = stringifyObject(componentOn)
  }

  if (!object.empty(componentDirectives)) {
    data.directives = stringifyObject(componentDirectives)
  }

  return stringifyObject(data)

}

function stringifyElementData(attrs: (Attribute | Spread)[] | void, props: Pair[] | void): string | void {

  const data: any = {},

  nativeAttrs = {},

  // 和组件保持一致，采用数组
  nativeProps = [],

  nativeOn = {},

  nativeDirectives = {}

  if (attrs) {
    array.each(
      attrs,
      function (attr: Attribute) {
        if (attr.directive) {
          if (attr.namespace === config.DIRECTIVE_EVENT) {
            nativeOn[attr.name] = stringifyEvent(attr.expr)
          }
          else {
            nativeDirectives[attr.name] = stringifyDirective(attr.value, attr.expr)
          }
        }
        else {
          nativeAttrs[keypathUtil.join(attr.namespace, attr.name)] = stringifyObject({
            namespace: toJSON(attr.namespace),
            name: toJSON(attr.name),
            value: stringifyValue(attr.value, attr.expr, attr.children),
          })
        }
      }
    )
  }

  // 目前只可能存在两个属性：text 和 html
  if (props) {
    array.each(
      props,
      function (prop: Pair) {
        array.push(
          nativeProps,
          stringifyObject({
            name: toJSON(prop.name),
            value: stringifyValue(prop.value, prop.expr),
          })
        )
      }
    )
  }

  if (!object.empty(nativeAttrs)) {
    data.attrs = stringifyObject(nativeAttrs)
  }

  if (nativeProps.length) {
    data.props = stringifyArray(nativeProps)
  }

  if (!object.empty(nativeOn)) {
    data.on = stringifyObject(nativeOn)
  }

  if (!object.empty(nativeDirectives)) {
    data.directives = stringifyObject(nativeDirectives)
  }

  return stringifyObject(data)

}

const nodeStringify = {}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  const { tag, component, attrs, props, children } = node,

  args: any[] = [toJSON(tag)],

  data = component ? stringifyComponentData(attrs, props) : stringifyElementData(attrs, props),

  childs = stringifyChildren(children, env.TRUE)

  if (data) {
    array.push(args, data)
  }

  if (isDef(childs)) {
    array.push(args, childs)
  }

  return stringifyCall(
    FUNC_ELEMENT,
    array.join(args, SEP_COMMA)
  )

}

nodeStringify[nodeType.TEXT] = function (node: Text): string {
  return toJSON(node.text)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyExpression(node.expr)
}

nodeStringify[nodeType.IF] = function (node: If): string {

  const { stump } = node,

  loop = function (node: If | ElseIf) {

    let expr = stringifyExpression(node.expr),

    children = stringifyChildren(node.children),

    nextNode = node.next,

    nextValue: string | void

    if (nextNode) {
      // 递归到最后一个条件
      if (nextNode.type === nodeType.ELSE) {
        nextValue = stringifyChildren(nextNode.children)
      }
      else {
        nextValue = loop(nextNode as ElseIf)
      }
    }
    // 到达最后一个条件，发现第一个 if 语句带有 stump，需标记出来
    else if (stump) {
      nextValue = stringifyComment()
    }

    return `${expr} ? ${isDef(children) ? children : stringifyEmpty()} : ${isDef(nextValue) ? nextValue : stringifyEmpty()}`

  }

  return loop(node)

}

export function stringify(node: Node): string {
  return nodeStringify[node.type](node)
}