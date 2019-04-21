import * as config from 'yox-config/index'

import isDef from 'yox-common/src/function/isDef'
import toJSON from 'yox-common/src/function/toJSON'

import * as env from 'yox-common/src/util/env'
import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as object from 'yox-common/src/util/object'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'

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

/**
 * 这里的难点在于处理 Element 的 children，举个例子：
 *
 * ['1', _x(expr), _l(expr, index, generate), _x(expr) ? ['1', _x(expr), _l(expr, index, generate)] : y]
 *
 * children 用数组表示，其中表达式求出的值可能是任意类型，比如数组或对象，我们无法控制表达式的值
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

const joinStack: boolean[] = [],

nodeStringify = {},

RENDER_ELEMENT = 'a',

RENDER_SLOT = 'b',

RENDER_EACH = 'c',

RENDER_EXPRESSION = 'e',

RENDER_EXPRESSION_TEXT = 'f',

RENDER_PURE_TEXT = 'g',

RENDER_PARTIAL = 'h',

RENDER_IMPORT = 'i',

SEP_COMMA = ', ',

SEP_COLON = ': ',

SEP_PLUS = ' + ',

CODE_RETURN = 'return ',

CODE_PREFIX = `function (${
  array.join([
    RENDER_EXPRESSION,
    RENDER_EXPRESSION_TEXT,
    RENDER_PURE_TEXT,
    RENDER_ELEMENT,
    RENDER_SLOT,
    RENDER_PARTIAL,
    RENDER_IMPORT,
    RENDER_EACH
  ], SEP_COMMA)
}) { return `,

CODE_SUFFIX = ` }`


// 是否正在处理 attrs
let processAttrs = env.FALSE


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

function stringifyFunction(code: string | void): string {
  return `function () { ${code || env.EMPTY_STRING} }`
}

function stringifyGroup(code: string): string {
  return `(${code})`
}

function stringifyExpression(expr: ExpressionNode, name?: string): string {
  return stringifyCall(
    name || RENDER_EXPRESSION,
    toJSON(expr)
  )
}

function stringifyValue(value: any, expr: ExpressionNode | void, children: Node[] | void): string | void {
  return isDef(value)
    ? toJSON(value)
    : expr
      ? stringifyExpression(expr)
      : stringifyChildren(children)
}

function stringifyChildren(children: Node[] | void, isComplex: boolean | void): string | void {
  // 如果是复杂节点的 children，则每个 child 的序列化都是函数调用的形式
  // 因此最后可以拼接为 fn1(), fn2(), fn3() 这样依次调用，而不用再多此一举的使用数组，因为在 renderer 里也用不上这个数组
  if (children && children.length) {
    array.push(
      joinStack,
      children.length > 1 && !isComplex
    )
    const value = array.join(
      children.map(
        function (child: Node) {
          return nodeStringify[child.type](child)
        }
      ),
      array.last(joinStack) ? SEP_PLUS : SEP_COMMA
    )
    array.pop(joinStack)
    return value
  }
}

function stringifyConditionChildren(children: Node[] | void, isComplex: boolean | void): string | void {
  const result = stringifyChildren(children, isComplex)
  return children && children.length > 1 && isComplex
    ? stringifyGroup(result as string)
    : result
}

function stringifyIf(node: If | ElseIf, stub: boolean | void) {

  let { children, isComplex, next } = node,

  test = stringifyExpression(node.expr),

  yes = stringifyConditionChildren(children, isComplex),

  no: string | void,

  empty = toJSON(env.EMPTY_STRING),

  result: string

  if (next) {
    no = next.type === nodeType.ELSE
      ? stringifyConditionChildren(next.children, next.isComplex)
      : stringifyIf(next as ElseIf, stub)
  }
  // 到达最后一个条件，发现第一个 if 语句带有 stub，需创建一个注释标签占位
  else if (stub) {
    no = stringifyCall(
      RENDER_ELEMENT,
      toJSON({
        isComment: env.TRUE,
        text: env.EMPTY_STRING,
      })
    )
  }

  if (isDef(yes) || isDef(no)) {

    result = `${test} ? ${isDef(yes) ? yes : empty} : ${isDef(no) ? no : empty}`

    // 如果是连接操作，因为 ?: 优先级最低，因此要加 ()
    return array.last(joinStack)
      ? stringifyGroup(result)
      : result
  }

  return empty

}

function getComponentSlots(children: Node[] | void): string | void {
  // 这里不用判断数组长度，因为下面会判断有效的 slot
  if (children) {

    const slots = {}, complexs = {},

    addSlot = function (name: string, nodes: Node[] | void, isComplex: boolean | void) {

      if (!array.falsy(nodes)) {
        array.push(
          slots[name] || (slots[name] = []),
          nodes
        )
        if (isComplex) {
          complexs[name] = isComplex
        }
      }

    }

    array.each(
      children,
      function (child: Node) {

        // 找到具名 slot
        if (child.type === nodeType.ELEMENT) {
          const element = child as Element
          if (element.slot) {
            addSlot(element.slot, element.children, element.isComplex)
            return
          }
        }

        // 匿名 slot，名称统一为 children
        addSlot(env.RAW_CHILDREN, [child], child.isComplex)

      }
    )

    // 全部收集完成之后，再序列化
    object.each(
      slots,
      function (children: any, name: string) {
        slots[name] = stringifyFunction(
          stringifyChildren(children, complexs[name])
        )
      }
    )

    if (!object.empty(slots)) {
      return stringifyObject(slots)
    }

  }
}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, isComponent, isSvg, isStatic, isComplex, name, ref, key, html, attrs, children } = node,

  args: string[] = [],

  data: Record<string, any> = { },

  elementAttrs: string[] = [],

  elementChildren: string | void

  if (tag === env.RAW_SLOT) {
    return stringifyCall(
      RENDER_SLOT,
      toJSON(name)
    )
  }

  if (attrs) {
    // 只有处理 children 需要 currentElement
    processAttrs = env.TRUE
    array.each(
      attrs,
      function (attr: Node) {
        array.push(
          elementAttrs,
          nodeStringify[attr.type](attr)
        )
      }
    )
    processAttrs = env.FALSE
  }

  data.tag = toJSON(tag)

  if (isSvg) {
    data.isSvg = env.TRUE
  }

  if (isStatic) {
    data.isStatic = env.TRUE
  }

  if (ref) {
    data.ref = stringifyValue(ref.value, ref.expr, ref.children)
  }

  if (key) {
    data.key = stringifyValue(key.value, key.expr, key.children)
  }

  if (html) {
    data.html = stringifyValue(env.UNDEFINED, html)
  }

  if (isComponent) {
    data.isComponent = env.TRUE
    data.slots = getComponentSlots(children)
  }
  else {
    elementChildren = stringifyChildren(children, isComplex)
    if (isDef(elementChildren)) {
      if (isComplex) {
        elementChildren = stringifyFunction(elementChildren)
      }
      else {
        data.text = elementChildren
        elementChildren = env.UNDEFINED
      }
    }
  }

  array.push(args, stringifyObject(data))

  // data 可以透传，但是 attrs 还需要 render 继续分析
  if (elementAttrs.length) {
    array.push(
      args,
      stringifyArray(elementAttrs)
    )
  }
  else if (elementChildren) {
    // renderer 里是直接 if (attrs) 判断，所以写 0 就行了，还能省点字符
    array.push(
      args,
      0
    )
  }

  if (elementChildren) {
    array.push(
      args,
      elementChildren
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
          CODE_RETURN + stringifyArray(args.map(stringifyExpression))
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
        CODE_RETURN + stringifyExpression(expr)
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
  const result = toJSON(node.text)
  return processAttrs || array.last(joinStack)
    ? result
    : stringifyCall(RENDER_PURE_TEXT, result)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyExpression(
    node.expr,
    processAttrs || array.last(joinStack)
    ? RENDER_EXPRESSION
    : RENDER_EXPRESSION_TEXT
  )
}

nodeStringify[nodeType.IF] = function (node: If): string {
  return stringifyIf(node, node.stub)
}

nodeStringify[nodeType.EACH] = function (node: Each): string {

  const expr = toJSON(node.expr),

  index = node.index ? `, ${toJSON(node.index)}` : env.EMPTY_STRING,

  children = stringifyFunction(
    stringifyChildren(node.children, node.isComplex)
  )

  return stringifyCall(RENDER_EACH, `${expr}${index}, ${children}`)

}

nodeStringify[nodeType.PARTIAL] = function (node: Partial): string {

  const name = toJSON(node.name),

  children = stringifyFunction(
    stringifyChildren(node.children, node.isComplex)
  )

  return stringifyCall(RENDER_PARTIAL, `${name}, ${children}`)

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