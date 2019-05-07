import * as config from '../../yox-config/src/config'
import * as type from '../../yox-type/src/type'

import isDef from '../../yox-common/src/function/isDef'
import isUndef from '../../yox-common/src/function/isUndef'
import toJSON from '../../yox-common/src/function/toJSON'

import * as env from '../../yox-common/src/util/env'
import * as array from '../../yox-common/src/util/array'
import * as string from '../../yox-common/src/util/string'
import * as object from '../../yox-common/src/util/object'

import * as exprNodeType from '../../yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'

import ExpressionNode from '../../yox-expression-compiler/src/node/Node'
import ExpressionLiteral from '../../yox-expression-compiler/src/node/Literal'
import ExpressionIdentifier from '../../yox-expression-compiler/src/node/Identifier'
import ExpressionCall from '../../yox-expression-compiler/src/node/Call'

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

/**
 * 这里的难点在于处理 Element 的 children，举个例子：
 *
 * ['1', _x(expr), _l(expr, index, generate), _x(expr) ? ['1', _x(expr), _l(expr, index, generate)] : y]
 *
 * children 用数组表示，其中表达式求出的值可能是任意类型，比如数组或对象，我们无法控制表达式的值最终会是什么类型
 *
 * 像 each 或 import 这样的语法，内部其实会产生一个 vnode 数组，这里就出现了两个难点：
 *
 * 1. 如何区分 each 或其他语法产生的数组和表达式求值的数组
 * 2. 如何避免频繁的创建数组
 *
 * 我能想到的解决方案是，根据当前节点类型，如果是元素，则确保 children 的每一项的值序列化后都是函数调用的形式
 *
 * 这样能确保是从左到右依次执行，也就便于在内部创建一个公共数组，执行一个函数就收集一个值，而不管那个值到底是什么类型
 *
 */

// 是否要执行 join 操作
const joinStack: boolean[] = [],

// 是否正在收集子节点
collectStack: (boolean | void)[] = [],

nodeStringify = {},

RENDER_SLOT = 'a',

RENDER_EACH = 'b',

RENDER_EXPRESSION = 'c',

RENDER_EXPRESSION_ARG = 'd',

RENDER_EXPRESSION_VNODE = 'e',

RENDER_TEXT_VNODE = 'f',

RENDER_ELEMENT_VNODE = 'g',

RENDER_PARTIAL = 'h',

RENDER_IMPORT = 'i',

ARG_CONTEXT = 'j',

SEP_COMMA = ',',

SEP_COLON = ':',

SEP_PLUS = '+',

STRING_TRUE = '!0',

STRING_FALSE = '!1',

STRING_EMPTY = toJSON(env.EMPTY_STRING),

CODE_RETURN = 'return ',

CODE_PREFIX = `function(${
  array.join([
    RENDER_EXPRESSION,
    RENDER_EXPRESSION_ARG,
    RENDER_EXPRESSION_VNODE,
    RENDER_TEXT_VNODE,
    RENDER_ELEMENT_VNODE,
    RENDER_SLOT,
    RENDER_PARTIAL,
    RENDER_IMPORT,
    RENDER_EACH
  ], SEP_COMMA)
}){return `,

CODE_SUFFIX = `}`

// 表达式求值是否要求返回字符串类型
let isStringRequired: boolean | void

function stringifyObject(obj: Object): string {
  const fields: string[] = []
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
  return `{${array.join(fields, SEP_COMMA)}}`
}

function stringifyArray(arr: any[]): string {
  return `[${array.join(arr, SEP_COMMA)}]`
}

function stringifyCall(name: string, arg: string): string {
  return `${name}(${arg})`
}

function stringifyFunction(result: string | void, arg?: string): string {
  return `function(${arg || env.EMPTY_STRING}){${result || env.EMPTY_STRING}}`
}

function stringifyGroup(code: string): string {
  return `(${code})`
}

function stringifyExpression(renderName: string, expr: ExpressionNode, extra: string[] | void): string {
  const args = [toJSON(expr)]
  if (extra) {
    array.push(args, extra)
  }
  return stringifyCall(
    renderName,
    array.join(args, SEP_COMMA)
  )
}

function stringifyExpressionArg(expr: ExpressionNode): string {
  return stringifyExpression(
    RENDER_EXPRESSION_ARG,
    expr,
    [ARG_CONTEXT]
  )
}

function stringifyValue(value: any, expr: ExpressionNode | void, children: Node[] | void): string | void {
  if (isDef(value)) {
    return toJSON(value)
  }
  // 只有一个表达式时，保持原始类型
  if (expr) {
    return stringifyExpression(RENDER_EXPRESSION, expr)
  }
  // 多个值拼接时，要求是字符串
  if (children) {
    isStringRequired = children.length > 1
    return stringifyChildren(children)
  }
}

function stringifyChildren(children: Node[], isComplex: boolean | void): string {
  // 如果是复杂节点的 children，则每个 child 的序列化都是函数调用的形式
  // 因此最后可以拼接为 fn1(), fn2(), fn3() 这样依次调用，而不用再多此一举的使用数组，因为在 renderer 里也用不上这个数组

  // children 大于一个时，才有 join 的可能，单个值 jion 啥啊...
  const isJoin = children.length > 1 && !isComplex

  array.push(joinStack, isJoin)
  const value = array.join(
    children.map(
      function (child: Node) {
        return nodeStringify[child.type](child)
      }
    ),
    isJoin ? SEP_PLUS : SEP_COMMA
  )
  array.pop(joinStack)

  return value

}

function stringifyConditionChildren(children: Node[] | void, isComplex: boolean | void): string | void {
  if (children) {
    const result = stringifyChildren(children, isComplex)
    return children.length > 1 && isComplex
      ? stringifyGroup(result)
      : result
  }
}

function stringifyIf(node: If | ElseIf, stub: boolean | void) {

  let { children, isComplex, next } = node,

  test = stringifyExpression(RENDER_EXPRESSION, node.expr),

  yes = stringifyConditionChildren(children, isComplex),

  no: string | void,

  result: string

  if (next) {
    no = next.type === nodeType.ELSE
      ? stringifyConditionChildren(next.children, next.isComplex)
      : stringifyIf(next as ElseIf, stub)
  }
  // 到达最后一个条件，发现第一个 if 语句带有 stub，需创建一个注释标签占位
  else if (stub) {
    no = renderElement(
      stringifyObject({
        isComment: STRING_TRUE,
        text: STRING_EMPTY,
      })
    )
  }

  if (isDef(yes) || isDef(no)) {

    result = `${test}?${isDef(yes) ? yes : STRING_EMPTY}:${isDef(no) ? no : STRING_EMPTY}`

    // 如果是连接操作，因为 ?: 优先级最低，因此要加 ()
    return array.last(joinStack)
      ? stringifyGroup(result)
      : result

  }

  return STRING_EMPTY

}

/**
 * 目的是 保证调用参数顺序稳定，减少运行时判断
 */
function trimArgs(list: (string | void)[]) {

  let args: string[] = [], removable = env.TRUE

  array.each(
    list,
    function (arg: string | void) {
      if (isDef(arg)) {
        removable = env.FALSE
        array.unshift(args, arg as string)
      }
      else if (!removable) {
        array.unshift(args, STRING_FALSE)
      }
    },
    env.TRUE
  )

  return args

}

function renderElement(data: string, attrs: string | void, childs: string | void, slots: string | void): string {
  return stringifyCall(
    RENDER_ELEMENT_VNODE,
    array.join(
      trimArgs([data, attrs, childs, slots]),
      SEP_COMMA
    )
  )
}

function getComponentSlots(children: Node[]): string | void {

  const result: Record<string, string> = {},

  slots: Record<string, Node[]> = {},

  addSlot = function (name: string, nodes: Node[] | void) {

    if (!array.falsy(nodes)) {
      name = config.SLOT_DATA_PREFIX + name
      array.push(
        slots[name] || (slots[name] = []),
        nodes as Node[]
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
      addSlot(config.SLOT_NAME_DEFAULT, [child])

    }
  )

  object.each(
    slots,
    function (children: any, name: string) {
      // 强制为复杂节点，因为 slot 的子节点不能用字符串拼接的方式来渲染
      result[name] = stringifyFunction(
        stringifyChildren(children, env.TRUE)
      )
    }
  )

  if (!object.falsy(result)) {
    return stringifyObject(result)
  }

}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, isComponent, isSvg, isStyle, isStatic, isComplex, name, ref, key, html, attrs, children } = node,

  data: type.data = {},

  outputAttrs: string[] = [],

  outputChilds: string | void,

  outputSlots: string | void,

  args: string[]

  if (tag === env.RAW_SLOT) {
    args = [toJSON(config.SLOT_DATA_PREFIX + name)]
    if (children) {
      array.push(
        args,
        stringifyFunction(
          stringifyChildren(children, env.TRUE)
        )
      )
    }
    return stringifyCall(
      RENDER_SLOT,
      array.join(args, SEP_COMMA)
    )
  }

  array.push(collectStack, env.FALSE)

  if (attrs) {
    array.each(
      attrs,
      function (attr: Node) {
        array.push(
          outputAttrs,
          nodeStringify[attr.type](attr)
        )
      }
    )
  }

  data.tag = toJSON(tag)

  if (isSvg) {
    data.isSvg = STRING_TRUE
  }

  if (isStyle) {
    data.isStyle = STRING_TRUE
  }

  if (isStatic) {
    data.isStatic = STRING_TRUE
  }

  if (ref) {
    data.ref = stringifyValue(ref.value, ref.expr, ref.children)
  }

  if (key) {
    data.key = stringifyValue(key.value, key.expr, key.children)
  }

  if (html) {
    data.html = stringifyExpression(RENDER_EXPRESSION, html, [STRING_TRUE])
  }

  if (isComponent) {
    data.isComponent = STRING_TRUE
    if (children) {
      collectStack[collectStack.length - 1] = env.TRUE
      outputSlots = getComponentSlots(children)
    }
  }
  else if (children) {
    isStringRequired = env.TRUE
    collectStack[collectStack.length - 1] = isComplex
    outputChilds = stringifyChildren(children, isComplex)
    if (isComplex) {
      outputChilds = stringifyFunction(outputChilds)
    }
    else {
      data.text = outputChilds
      outputChilds = env.UNDEFINED
    }
  }

  array.pop(collectStack)

  return renderElement(
    stringifyObject(data),
    array.falsy(outputAttrs)
      ? env.UNDEFINED
      : stringifyArray(outputAttrs),
    outputChilds,
    outputSlots
  )

}

nodeStringify[nodeType.ATTRIBUTE] = function (node: Attribute): string {
  const result: type.data = {
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
  const result: type.data = {
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

  const { type, ns, expr } = node,

  result: type.data = {
    // renderer 遍历 attrs 要用 type
    type,
    ns: toJSON(ns),
    name: toJSON(node.name),
    key: toJSON(node.key),
    value: toJSON(node.value),
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
      // compiler 保证了函数调用的 name 是标识符
      result.method = toJSON(((expr as ExpressionCall).name as ExpressionIdentifier).name)
      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy((expr as ExpressionCall).args)) {
        // args 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
        result.args = stringifyFunction(
          CODE_RETURN + stringifyArray((expr as ExpressionCall).args.map(stringifyExpressionArg)),
          ARG_CONTEXT
        )
      }
    }
    // 不是调用方法，就是事件转换
    else if (ns === config.DIRECTIVE_EVENT) {
      result.event = toJSON(expr.raw)
    }
    // <input model="id">
    else if (ns === config.DIRECTIVE_MODEL) {
      result.expr = toJSON(expr)
    }
    else if (ns === config.DIRECTIVE_CUSTOM) {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        result.getter = stringifyFunction(
          CODE_RETURN + stringifyExpressionArg(expr),
          ARG_CONTEXT
        )
      }

    }

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

  const result = toJSON(node.text)

  if (array.last(collectStack) && !array.last(joinStack)) {
    return stringifyCall(
      RENDER_TEXT_VNODE,
      result
    )
  }

  return result
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {

  // 强制保留 isStringRequired 参数，减少运行时判断参数是否存在
  // 因为还有 stack 参数呢，各种判断真的很累
  let renderName = RENDER_EXPRESSION,

  args = [isStringRequired ? STRING_TRUE : env.UNDEFINED]

  if (array.last(collectStack) && !array.last(joinStack)) {
    renderName = RENDER_EXPRESSION_VNODE
  }

  return stringifyExpression(
    renderName,
    node.expr,
    trimArgs(args),
  )
}

nodeStringify[nodeType.IF] = function (node: If): string {
  return stringifyIf(node, node.stub)
}

nodeStringify[nodeType.EACH] = function (node: Each): string {

  const expr = toJSON(node.expr),

  index = node.index ? `${SEP_COMMA}${toJSON(node.index)}` : env.EMPTY_STRING,

  // compiler 保证了 children 一定有值
  children = stringifyFunction(
    stringifyChildren(node.children as Node[], node.isComplex)
  )

  return stringifyCall(RENDER_EACH, `${expr}${index}${SEP_COMMA}${children}`)

}

nodeStringify[nodeType.PARTIAL] = function (node: Partial): string {

  const name = toJSON(node.name),

  // compiler 保证了 children 一定有值
  children = stringifyFunction(
    stringifyChildren(node.children as Node[], node.isComplex)
  )

  return stringifyCall(RENDER_PARTIAL, `${name}${SEP_COMMA}${children}`)

}

nodeStringify[nodeType.IMPORT] = function (node: Import): string {

  const name = toJSON(node.name)

  return stringifyCall(RENDER_IMPORT, `${name}`)

}

export function stringify(node: Node): string {
  return CODE_PREFIX + nodeStringify[node.type](node) + CODE_SUFFIX
}

export function hasStringify(code: string): boolean {
  return string.startsWith(code, CODE_PREFIX)
}