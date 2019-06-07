import * as config from '../../yox-config/src/config'
import * as type from '../../yox-type/src/type'

import isDef from '../../yox-common/src/function/isDef'
import toJSON from '../../yox-common/src/function/toJSON'

import * as env from '../../yox-common/src/util/env'
import * as array from '../../yox-common/src/util/array'
import * as string from '../../yox-common/src/util/string'
import * as object from '../../yox-common/src/util/object'
import * as stringifier from '../../yox-common/src/util/stringify'

import * as exprStringify from '../../yox-expression-compiler/src/stringify'
import * as exprNodeType from '../../yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'

import ExpressionNode from '../../yox-expression-compiler/src/node/Node'
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

RENDER_ATTRIBUTE_VNODE = 'g',

RENDER_PROPERTY_VNODE = 'h',

RENDER_LAZY_VNODE = 'i',

RENDER_TRANSITION_VNODE = 'j',

RENDER_BINDING_VNODE = 'k',

RENDER_MODEL_VNODE = 'l',

RENDER_EVENT_METHOD_VNODE = 'm',

RENDER_EVENT_NAME_VNODE = 'n',

RENDER_DIRECTIVE_VNODE = 'o',

RENDER_SPREAD_VNODE = 'p',

RENDER_ELEMENT_VNODE = 'q',

RENDER_EXPRESSION_IDENTIFIER = 'r',

RENDER_EXPRESSION_MEMBER_IDENTIFIER = 's',

RENDER_EXPRESSION_MEMBER_LITERAL = 't',

RENDER_EXPRESSION_CALL = 'u',

RENDER_PARTIAL = 'v',

RENDER_IMPORT = 'w',

ARG_CONTEXT = 'x',

SEP_COMMA = ',',

SEP_COLON = ':',

SEP_PLUS = '+',

SEP_AND = '&&',

CODE_RETURN = 'return '

// 序列化代码的前缀
let codePrefix: string | void,

// 表达式求值是否要求返回字符串类型
isStringRequired: boolean | void

function getCodePrefix() {
  if (!codePrefix) {
    codePrefix = `function(${
      array.join([
        RENDER_EXPRESSION,
        RENDER_EXPRESSION_ARG,
        RENDER_EXPRESSION_VNODE,
        RENDER_TEXT_VNODE,
        RENDER_ATTRIBUTE_VNODE,
        RENDER_PROPERTY_VNODE,
        RENDER_LAZY_VNODE,
        RENDER_TRANSITION_VNODE,
        RENDER_BINDING_VNODE,
        RENDER_MODEL_VNODE,
        RENDER_EVENT_METHOD_VNODE,
        RENDER_EVENT_NAME_VNODE,
        RENDER_DIRECTIVE_VNODE,
        RENDER_SPREAD_VNODE,
        RENDER_ELEMENT_VNODE,
        RENDER_EXPRESSION_IDENTIFIER,
        RENDER_EXPRESSION_MEMBER_IDENTIFIER,
        RENDER_EXPRESSION_MEMBER_LITERAL,
        RENDER_EXPRESSION_CALL,
        RENDER_SLOT,
        RENDER_PARTIAL,
        RENDER_IMPORT,
        RENDER_EACH
      ], SEP_COMMA)
    }){${CODE_RETURN}`
  }
  return codePrefix
}

function renderExpression(expr: ExpressionNode, holder?: boolean, depIgnore?: boolean) {
  return exprStringify.stringify(
    expr,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    holder,
    depIgnore
  )
}

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
  return stringifier.toObject(fields)
}

function stringifyFunction(result: string | void, arg?: string): string {
  return `${env.RAW_FUNCTION}(${arg || env.EMPTY_STRING}){${result || env.EMPTY_STRING}}`
}

function stringifyGroup(code: string): string {
  return `(${code})`
}

function stringifyExpression(renderName: string, expr: ExpressionNode, extra?: any): string {
  return stringifier.toCall(
    renderName,
    [
      renderExpression(expr),
      extra
    ]
  )
}

function stringifyExpressionArg(expr: ExpressionNode): string {
  return stringifyExpression(
    RENDER_EXPRESSION_ARG,
    expr,
    ARG_CONTEXT
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
        isComment: stringifier.TRUE,
        text: stringifier.EMPTY,
      })
    )
  }

  if (isDef(yes) || isDef(no)) {

    const isJoin = array.last(joinStack)

    if (isJoin) {
      if (!isDef(yes)) {
        yes = stringifier.EMPTY
      }
      if (!isDef(no)) {
        no = stringifier.EMPTY
      }
    }

    if (!isDef(no)) {
      result = `${test}${SEP_AND}${yes}`
    }
    else if (!isDef(yes)) {
      result = `!${test}${SEP_AND}${no}`
    }
    else {
      result = `${test}?${yes}:${no}`
    }

    // 如果是连接操作，因为 ?: 优先级最低，因此要加 ()
    return isJoin
      ? stringifyGroup(result)
      : result

  }

  return stringifier.EMPTY

}

function renderElement(data: string, tag: string | void, attrs: string | void, childs: string | void, slots: string | void): string {
  return stringifier.toCall(
    RENDER_ELEMENT_VNODE,
    [data, tag, attrs, childs, slots]
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
          addSlot(
            element.slot,
            element.tag === env.RAW_TEMPLATE
              ? element.children
              : [element]
          )
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

  let { tag, isComponent, isSvg, isStyle, isOption, isStatic, isComplex, name, ref, key, html, attrs, children } = node,

  data: type.data = {},

  outputTag: string | void,

  outputAttrs: string[] = [],

  outputChilds: string | void,

  outputSlots: string | void

  if (tag === env.RAW_SLOT) {
    const args = [toJSON(config.SLOT_DATA_PREFIX + name)]
    if (children) {
      array.push(
        args,
        stringifyFunction(
          stringifyChildren(children, env.TRUE)
        )
      )
    }
    return stringifier.toCall(RENDER_SLOT, args)
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

  // 如果以 $ 开头，表示动态组件
  if (string.codeAt(tag) === 36) {
    outputTag = toJSON(string.slice(tag, 1))
  }
  else {
    data.tag = toJSON(tag)
  }

  if (isSvg) {
    data.isSvg = stringifier.TRUE
  }

  if (isStyle) {
    data.isStyle = stringifier.TRUE
  }

  if (isOption) {
    data.isOption = stringifier.TRUE
  }

  if (isStatic) {
    data.isStatic = stringifier.TRUE
  }

  if (ref) {
    data.ref = stringifyValue(ref.value, ref.expr, ref.children)
  }

  if (key) {
    data.key = stringifyValue(key.value, key.expr, key.children)
  }

  if (html) {
    data.html = stringifyExpression(RENDER_EXPRESSION, html, stringifier.TRUE)
  }

  if (isComponent) {
    data.isComponent = stringifier.TRUE
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
    outputTag,
    array.falsy(outputAttrs)
      ? env.UNDEFINED
      : stringifyFunction(
          array.join(outputAttrs, SEP_COMMA)
        ),
    outputChilds,
    outputSlots
  )

}

nodeStringify[nodeType.ATTRIBUTE] = function (node: Attribute): string {

  const value = node.binding
    ? stringifier.toCall(
      RENDER_BINDING_VNODE,
      [
        toJSON(node.name),
        renderExpression(node.expr as ExpressionNode, env.TRUE, env.TRUE)
      ]
    )
    : stringifyValue(node.value, node.expr, node.children)

  return stringifier.toCall(
    RENDER_ATTRIBUTE_VNODE,
    [
      toJSON(node.name),
      value
    ]
  )

}

nodeStringify[nodeType.PROPERTY] = function (node: Property): string {

  const value = node.binding
    ? stringifier.toCall(
      RENDER_BINDING_VNODE,
      [
        toJSON(node.name),
        renderExpression(node.expr as ExpressionNode, env.TRUE, env.TRUE),
        toJSON(node.hint)
      ]
    )
    : stringifyValue(node.value, node.expr, node.children)

  return stringifier.toCall(
    RENDER_PROPERTY_VNODE,
    [
      toJSON(node.name),
      toJSON(node.hint),
      value
    ]
  )

}

nodeStringify[nodeType.DIRECTIVE] = function (node: Directive): string {

  const { ns, name, key, value, expr } = node

  if (ns === config.DIRECTIVE_LAZY) {
    return stringifier.toCall(
      RENDER_LAZY_VNODE,
      [toJSON(name), toJSON(value)]
    )
  }

  if (ns === env.RAW_TRANSITION) {
    return stringifier.toCall(
      RENDER_TRANSITION_VNODE,
      [toJSON(value)]
    )
  }

  // <input model="id">
  if (ns === config.DIRECTIVE_MODEL) {
    return stringifier.toCall(
      RENDER_MODEL_VNODE,
      [
        renderExpression(expr as ExpressionNode, env.TRUE, env.TRUE)
      ]
    )
  }

  let renderName = RENDER_DIRECTIVE_VNODE,

  args: (string | undefined)[] = [
    toJSON(name),
    toJSON(key),
    toJSON(value),
  ]

  // 尽可能把表达式编译成函数，这样对外界最友好
  //
  // 众所周知，事件指令会编译成函数，对于自定义指令来说，也要尽可能编译成函数
  //
  // 比如 o-tap="method()" 或 o-log="{'id': '11'}"
  // 前者会编译成 handler（调用方法），后者会编译成 getter（取值）

  if (expr) {

    // 如果表达式明确是在调用方法，则序列化成 method + args 的形式
    if (expr.type === exprNodeType.CALL) {
      if (ns === config.DIRECTIVE_EVENT) {
        renderName = RENDER_EVENT_METHOD_VNODE
      }
      // compiler 保证了函数调用的 name 是标识符
      array.push(
        args,
        toJSON(((expr as ExpressionCall).name as ExpressionIdentifier).name)
      )
      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy((expr as ExpressionCall).args)) {
        // args 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
        array.push(
          args,
          stringifyFunction(
            CODE_RETURN + stringifier.toArray((expr as ExpressionCall).args.map(stringifyExpressionArg)),
            ARG_CONTEXT
          )
        )
      }
    }
    // 不是调用方法，就是事件转换
    else if (ns === config.DIRECTIVE_EVENT) {
      renderName = RENDER_EVENT_NAME_VNODE
      array.push(
        args,
        toJSON(expr.raw)
      )
    }
    else if (ns === config.DIRECTIVE_CUSTOM) {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        array.push(args, env.UNDEFINED) // method
        array.push(args, env.UNDEFINED) // args
        array.push(
          args,
          stringifyFunction(
            CODE_RETURN + stringifyExpressionArg(expr),
            ARG_CONTEXT
          )
        )
      }

    }

  }

  return stringifier.toCall(renderName, args)

}

nodeStringify[nodeType.SPREAD] = function (node: Spread): string {
  return stringifier.toCall(
    RENDER_SPREAD_VNODE,
    [
      renderExpression(node.expr, env.TRUE, node.binding)
    ]
  )
}

nodeStringify[nodeType.TEXT] = function (node: Text): string {

  const result = toJSON(node.text)

  if (array.last(collectStack) && !array.last(joinStack)) {
    return stringifier.toCall(
      RENDER_TEXT_VNODE,
      [result]
    )
  }

  return result
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {

  // 强制保留 isStringRequired 参数，减少运行时判断参数是否存在
  // 因为还有 stack 参数呢，各种判断真的很累

  return stringifyExpression(
    array.last(collectStack) && !array.last(joinStack)
      ? RENDER_EXPRESSION_VNODE
      : RENDER_EXPRESSION,
    node.expr,
    isStringRequired ? stringifier.TRUE : env.UNDEFINED
  )
}

nodeStringify[nodeType.IF] = function (node: If): string {
  return stringifyIf(node, node.stub)
}

nodeStringify[nodeType.EACH] = function (node: Each): string {

  return stringifier.toCall(
    RENDER_EACH,
    [
      // compiler 保证了 children 一定有值
      stringifyFunction(
        stringifyChildren(node.children as Node[], node.isComplex)
      ),
      renderExpression(node.from, env.TRUE),
      node.to ? renderExpression(node.to, env.TRUE) : env.UNDEFINED,
      node.equal ? stringifier.TRUE : env.UNDEFINED,
      node.index ? toJSON(node.index) : env.UNDEFINED
    ]
  )

}

nodeStringify[nodeType.PARTIAL] = function (node: Partial): string {

  return stringifier.toCall(
    RENDER_PARTIAL,
    [
      toJSON(node.name),
      // compiler 保证了 children 一定有值
      stringifyFunction(
        stringifyChildren(node.children as Node[], node.isComplex)
      )
    ]
  )

}

nodeStringify[nodeType.IMPORT] = function (node: Import): string {

  return stringifier.toCall(
    RENDER_IMPORT,
    [toJSON(node.name)]
  )

}

export function stringify(node: Node): string {
  return getCodePrefix() + nodeStringify[node.type](node) + '}'
}

export function hasStringify(code: string): boolean {
  return string.startsWith(code, getCodePrefix())
}