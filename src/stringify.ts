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

const RENDER_SLOT = '_s'

const RENDER_EACH = '_l'

const RENDER_EMPTY = '_e'

const RENDER_EXPRESSION = '_x'

const RENDER_CHILDREN = '_v'

const RENDER_PARTIAL = '_p'

const RENDER_IMPORT = '_i'

const SEP_COMMA = ', '

const SEP_COLON = ': '

const SEP_PLUS = ' + '

let args = [
  RENDER_EMPTY,
  RENDER_CHILDREN,
  RENDER_EXPRESSION,
  RENDER_ELEMENT,
  RENDER_SLOT,
  RENDER_PARTIAL,
  RENDER_IMPORT,
  RENDER_EACH
]

// 外部用这个判断字符串是否是已编译
export const prefix = `;function (${array.join(args, SEP_COMMA)}) { return `

export const suffix = ` }`

args = env.UNDEFINED

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
  callback: (childs: string[], isSimple: boolean) => string | void
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
        array.push(childs, nodeStringify[child.type](child))
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

  const { tag, isComponent, isSvg, isStatic, name, ref, key, attrs, children } = node,

  args: string[] = [],

  data: Record<string, any> = { },

  attributes: string[] = []

  if (tag === env.RAW_SLOT) {
    return stringifyCall(
      RENDER_SLOT,
      toJSON(name)
    )
  }

  if (attrs) {
    array.each(
      attrs,
      function (attr: Node) {
        array.push(
          attributes,
          nodeStringify[attr.type](attr)
        )
      }
    )
  }

  data.tag = toJSON(tag)

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
    data.slots = getComponentSlots(children)
  }
  else {
    stringifyChildren(
      children,
      function (childs: string[], isSimple: boolean) {
        if (isSimple) {
          data.text = array.join(childs, SEP_PLUS)
        }
        else {
          data.children = stringifyArray(childs)
        }
      }
    )
  }

  array.push(args, stringifyObject(data))

  // data 可以透传，但是 attributes 还需要 render 继续分析
  if (attributes.length) {
    array.push(
      args,
      stringifyArray(attributes)
    )
  }

  return stringifyCall(
    RENDER_ELEMENT,
    array.join(args, SEP_COMMA)
  )

}

nodeStringify[nodeType.ATTRIBUTE] = function (node: Attribute): string {
  const result: Record<string, any> = {
    type: node.type,
    name: toJSON(node.name),
    binding: node.binding,
  }
  if (node.binding) {
    result.expr = toJSON(node.expr)
  }
  else {
    result.value = stringifyValue(node.value, node.expr, node.children)
  }
  return stringifyObject(result)
}

nodeStringify[nodeType.PROPERTY] = function (node: Property): string {
  const result: Record<string, any> = {
    type: node.type,
    name: toJSON(node.name),
    hint: node.hint,
    binding: node.binding,
  }
  if (node.binding) {
    result.expr = toJSON(node.expr)
  }
  else {
    result.value = stringifyValue(node.value, node.expr, node.children)
  }
  return stringifyObject(result)
}

nodeStringify[nodeType.DIRECTIVE] = function (node: Directive): string {

  const { type, name, value, expr } = node,

  result: Record<string, any> = {
    // renderer 遍历 attrs 要用 type
    type,
    name: toJSON(name),
    modifier: toJSON(node.modifier),
  }

  // 尽可能把表达式编译成函数，这样对外界最友好
  //
  // 众所周知，事件指令会编译成函数，对于自定义指令来说，也要尽可能编译成函数
  //
  // 比如 o-tap="method()" 或 o-log="{'id': '11'}"
  // 前者会编译成 handler（调用方法），后者会编译成 getter（取值）

  if (expr) {

    // 如果表达式明确是在调用方法，则序列化成 method + args 的形式
    if (expr.type === exprNodeType.CALL) {
      const { callee, args } = expr as ExpressionCall
      // compiler 保证了函数调用的 callee 是标识符
      result.method = toJSON((callee as ExpressionIdentifier).name)
      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy(args)) {
        result.args = stringifyFunction(
          stringifyArray(args.map(stringifyExpression))
        )
      }
    }
    else if (name === config.DIRECTIVE_EVENT) {
      // compiler 保证了这里只能是标识符
      result.event = toJSON((expr as ExpressionIdentifier).name)
    }
    else if (name === config.DIRECTIVE_CUSTOM) {
      // 取值函数
      result.getter = stringifyFunction(
        stringifyExpression(expr)
      )
    }

  }

  // <input model="id">
  if (name === config.DIRECTIVE_MODEL) {
    result.expr = toJSON(expr)
  }
  else {
    result.value = toJSON(value)
  }

  return stringifyObject(result)

}

nodeStringify[nodeType.SPREAD] = function (node: Spread): string {
  return stringifyObject({
    type: node.type,
    expr: toJSON(node.expr),
    binding: node.binding,
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
        toJSON({
          isComment: env.TRUE,
          text: env.EMPTY_STRING,
        })
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
  return prefix + nodeStringify[node.type](node) + suffix
}
