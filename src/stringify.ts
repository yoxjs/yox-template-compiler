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


import ElementVNode from './vnode/Element'

const RENDER_ELEMENT = '_c'
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

const simpleStack = []

function stringifyChildren(
  children: Node[] | void,
  callback: (childs: string[], isSimple: boolean) => string
): string | void {
  if (children && children.length) {

    const childs: string[] = []

    // 如果 children 只包含简单子节点，则用 + 连起来提升运行时性能
    array.push(simpleStack, env.TRUE)

    array.each(
      children,
      function (child: Node) {
        if (array.last(simpleStack)
          && !helper.simpleChildTypes[child.type]
        ) {
          simpleStack[simpleStack.length - 1] = env.FALSE
        }
        array.push(childs, stringify(child))
      }
    )

    const isSimple = array.pop(simpleStack)
    if (!isSimple && simpleStack.length) {
      simpleStack[simpleStack.length - 1] = env.FALSE
    }

    return callback(childs, isSimple)
  }
}

function stringifyNormalChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], isSimple: boolean): string {
      return isSimple
        ? array.join(childs, SEP_PLUS)
        : stringifyCall(RENDER_CHILDREN, stringifyArray(childs))
    }
  )
}

function stringifyElementChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], isSimple: boolean): string {
      // 遵循 virtual dom 行业规则，children 可以是 string 或 array
      return isSimple
        ? array.join(childs, SEP_PLUS)
        : stringifyArray(childs)
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

  let { tag, isComponent, isSvg, isStatic, slot, name, ref, key, transition, attrs, children } = node,

  args: any[] = [],

  data: Record<string, any> = { },

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

  data.tag = toJSON(tag)

  if (isDef(slot)) {
    data.slot = toJSON(slot)
  }

  if (isDef(name)) {
    data.name = toJSON(name)
  }

  if (isDef(transition)) {
    data.transition = toJSON(transition)
  }

  if (ref) {
    data.ref = stringifyValue(ref.value, ref.expr, ref.children)
  }

  if (key) {
    data.key = stringifyValue(key.value, key.expr, key.children)
  }

  if (isSvg) {
    data.isSvg = env.TRUE
  }

  if (isStatic) {
    data.isStatic = env.TRUE
  }

  if (isComponent) {
    data.isComponent = env.TRUE
    slots = getComponentSlots(children)
    if (slots) {
      data.slots = slots
    }
  }
  else {
    childs = stringifyElementChildren(children)
    if (isDef(childs)) {
      data.children = childs
    }
  }

  array.push(args, stringifyObject(data))

  // data 可以透传，但是 attributes 还需要 render 继续分析
  array.push(
    args,
    stringifyArray(attributes)
  )

  return stringifyCall(
    RENDER_ELEMENT,
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
  let { type, name, expr } = node
  if (name === config.DIRECTIVE_EVENT) {
    if (expr.type === exprNodeType.IDENTIFIER) {
      return stringifyObject({
        type,
        name: toJSON(name),
        event: toJSON((expr as ExpressionIdentifier).name)
      })
    }
    else if (expr.type === exprNodeType.CALL) {
      const { callee, args } = expr as ExpressionCall
      if (callee.type === exprNodeType.IDENTIFIER) {
        return stringifyObject({
          type,
          name: toJSON(name),
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
  // <input model="id"> 和 <div id="{{id}}">
  else if (name === config.DIRECTIVE_MODEL || name === config.DIRECTIVE_BIND) {
    return stringifyObject({
      type,
      name: toJSON(name),
      expr: toJSON(node.expr),
    })
  }
  // <div lazy="100">
  else if (name === config.DIRECTIVE_LAZY) {
    return stringifyObject({
      type,
      name: toJSON(name),
      // 只可能是 number 或 boolean，不需要 toJSON
      value: node.value,
    })
  }
  return stringifyObject({
    type,
    name: toJSON(name),
    modifier: toJSON(node.modifier),
    value: stringifyDirective(node.value, expr)
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
    type: node.type,
    expr: toJSON(node.expr)
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
    RENDER_EXPRESSION,
    RENDER_ELEMENT,
    RENDER_PARTIAL,
    RENDER_IMPORT,
    RENDER_EACH,
    `return ${code}`
  )
}