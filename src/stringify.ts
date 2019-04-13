import * as config from 'yox-config'

import isDef from 'yox-common/function/isDef'
import toJSON from 'yox-common/function/toJSON'

import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'

import * as helper from './helper'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'

import Node from './node/Node'
import Text from './node/Text'
import Each from './node/Each'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
import Expression from './node/Expression'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'

const RENDER_ELEMENT = '_c'
const RENDER_COMPONENT = '_d'
const RENDER_EACH = '_l'
const RENDER_EMPTY = '_e'
const RENDER_EXPRESSION = '_x'
const RENDER_CHILDREN = '_v'
const RENDER_PARTIAL = '_p'
const RENDER_IMPORT = '_i'

const SEP_COMMA = ', '
const SEP_COLON = ': '
const SEP_PLUS = ' + '

function stringifyObject(obj: Object): string {
  const fields = []
  object.each(
    obj,
    function (value: any, key: string) {
      if (isDef(value)) {
        array.push(
          fields,
          `${toJSON(key)}${SEP_COLON}${value}`
        )
      }
    }
  )
  return `{ ${array.join(fields, SEP_COMMA)} }`
}

function stringifyArray(arr: any[]): string {
  return `[ ${array.join(arr, SEP_COMMA)} ]`
}

function stringifyCall(name: string, arg: string): string {
  return `${name}(${arg})`
}

function stringifyFunction(result: string | void): string {
  return `function () { return ${result || env.EMPTY_STRING} }`
}

function stringifyExpression(expr: ExpressionNode): string {
  return stringifyCall(
    RENDER_EXPRESSION,
    toJSON(expr)
  )
}

function stringifyEmpty(): string {
  return stringifyCall(RENDER_EMPTY, env.EMPTY_STRING)
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
          // 为了实现运行时动态收集参数，这里序列化成函数
          ? stringifyFunction(
              stringifyArray(args.map(stringifyExpression))
            )
          : env.UNDEFINED,
      })
    }
  }
}

function stringifyDirective(value: string | undefined, expr: ExpressionNode | undefined): string {
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
      : stringifyNormalChildren(children)
}

function stringifyChildren(
  children: Node[] | void,
  callback: (childs: string[], hasComplexChild: boolean) => string
): string | void {
  if (children && children.length) {
    // 如果 children 只包含简单子节点，则用 + 连起来提升运行时性能
    let childs: string[] = [], hasComplexChild = env.FALSE
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
    return callback(childs, hasComplexChild)
  }
}

function stringifyNormalChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], hasComplexChild: boolean): string {
      return hasComplexChild
        ? stringifyCall(RENDER_CHILDREN, stringifyArray(childs))
        : array.join(childs, SEP_PLUS)
    }
  )
}

function stringifyElementChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], hasComplexChild: boolean): string {
      // 遵循 virtual dom 行业规则，children 可以是 string 或 array
      return hasComplexChild
        ? stringifyArray(childs)
        : array.join(childs, SEP_PLUS)
    }
  )
}

function getComponentSlots(children: Node[] | void): string | void {
  // 这里不用判断数组长度，因为下面会判断有效的 slot
  if (children) {

    const slots = { },

    addSlot = function (name: string, nodes: Node[] | void) {

      if (nodes && nodes.length) {
        array.push(
          slots[name] || (slots[name] = []),
          nodes
        )
      }

    }

    array.each(
      children,
      function (child: Node) {

        // 找到具名 slot
        if (child.type === nodeType.ELEMENT) {
          const element = child as Element
          if (element.slot) {
            addSlot(element.slot, element.children)
            return
          }
        }

        // 匿名 slot，名称统一为 children
        addSlot(env.RAW_CHILDREN, [child])

      }
    )

    // 全部收集完成之后，再序列化
    object.each(
      slots,
      function (list: any, name: string) {
        slots[name] = stringifyNormalChildren(list)
      }
    )

    if (!object.empty(slots)) {
      return stringifyObject(slots)
    }

  }
}

const nodeStringify = {}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, component, slot, name, ref, key, transition, attrs, children } = node,

  args: any[] = [toJSON(tag)],

  data: any = { },

  slots: any,

  childs: any,

  attributes: any[] = []

  if (attrs) {
    array.each(
      attrs,
      function (attr: Node) {
        array.push(
          attributes,
          stringify(attr)
        )
      }
    )
  }

  if (isDef(slot)) {
    data.slot = slot
  }

  if (isDef(name)) {
    data.name = name
  }

  if (isDef(transition)) {
    data.transition = transition
  }

  if (ref) {
    data.ref = stringifyValue(ref.value, ref.expr, ref.children)
  }

  if (key) {
    data.key = stringifyValue(key.value, key.expr, key.children)
  }

  if (component) {
    slots = getComponentSlots(children)
    if (slots) {
      data.slots = slots
    }
  }
  else {
    childs = stringifyElementChildren(children)
  }

  if (attributes.length) {
    data.attrs = stringifyArray(attributes)
  }

  if (!object.empty(data)) {
    array.push(args, stringifyObject(data))
  }

  if (isDef(childs)) {
    array.push(args, childs)
  }

  return stringifyCall(
    component ? RENDER_COMPONENT : RENDER_ELEMENT,
    array.join(args, SEP_COMMA)
  )

}

nodeStringify[nodeType.ATTRIBUTE] = function (node: Attribute): string {
  return stringifyObject({
    type: node.type,
    namespace: toJSON(node.namespace),
    name: toJSON(node.name),
    value: stringifyValue(node.value, node.expr, node.children),
  })
}

nodeStringify[nodeType.DIRECTIVE] = function (node: Directive): string {
  return stringifyObject({
    type: node.type,
    name: toJSON(node.name),
    modifier: toJSON(node.modifier),
    value: stringifyDirective(node.value, node.expr)
  })
}

nodeStringify[nodeType.PROPERTY] = function (node: Property): string {
  return stringifyObject({
    type: node.type,
    name: toJSON(node.name),
    hint: node.hint,
    value: stringifyValue(node.value, node.expr, node.children),
  })
}

nodeStringify[nodeType.SPREAD] = function (node: Spread): string {
  return stringifyObject({
    spread: stringifyExpression(node.expr)
  })
}

nodeStringify[nodeType.TEXT] = function (node: Text): string {
  return toJSON(node.text)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyExpression(node.expr)
}

nodeStringify[nodeType.IF] = function (node: If): string {

  const { stub } = node,

  render = function (node: If | ElseIf) {

    let expr = stringifyExpression(node.expr),

    children = stringifyNormalChildren(node.children),

    nextNode = node.next,

    nextValue: string | void

    if (nextNode) {
      // 递归到最后一个条件
      if (nextNode.type === nodeType.ELSE) {
        nextValue = stringifyNormalChildren(nextNode.children)
      }
      else {
        nextValue = render(nextNode as ElseIf)
      }
    }
    // 到达最后一个条件，发现第一个 if 语句带有 stub，需创建一个注释标签占位
    else if (stub) {
      nextValue = stringifyCall(
        RENDER_ELEMENT,
        `${toJSON(config.TAG_COMMENT)}, ${toJSON(env.EMPTY_STRING)}`
      )
    }

    return `${expr} ? ${isDef(children) ? children : stringifyEmpty()} : ${isDef(nextValue) ? nextValue : stringifyEmpty()}`

  }

  return render(node)

}

nodeStringify[nodeType.EACH] = function (node: Each): string {

  const expr = toJSON(node.expr),

  index = node.index ? `, ${toJSON(node.index)}` : env.EMPTY_STRING,

  children = stringifyFunction(
    stringifyNormalChildren(node.children)
  )

  return stringifyCall(RENDER_EACH, `${expr}${index}, ${children}`)

}

nodeStringify[nodeType.PARTIAL] = function (node: Partial): string {

  const name = toJSON(node.name),

  children = stringifyFunction(
    stringifyNormalChildren(node.children)
  )

  return stringifyCall(RENDER_PARTIAL, `${name}, ${children}`)

}

nodeStringify[nodeType.IMPORT] = function (node: Import): string {

  const name = toJSON(node.name)

  return stringifyCall(RENDER_IMPORT, `${name}`)

}

export function stringify(node: Node): string {
  return nodeStringify[node.type](node)
}

export function convert(code: string): Function {
  return new Function(
    RENDER_EMPTY,
    RENDER_CHILDREN,
    RENDER_COMPONENT,
    RENDER_ELEMENT,
    RENDER_EXPRESSION,
    RENDER_PARTIAL,
    RENDER_IMPORT,
    RENDER_EACH,
    `return ${code}`
  )
}