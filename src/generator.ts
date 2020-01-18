import {
  SLOT_DATA_PREFIX,
  SLOT_NAME_DEFAULT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_CUSTOM,
} from 'yox-config/src/config'

import isDef from 'yox-common/src/function/isDef'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as constant from 'yox-common/src/util/constant'
import * as generator from 'yox-common/src/util/generator'

import * as exprGenerator from 'yox-expression-compiler/src/generator'
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

// 是否正在收集子节点
const collectStack: (boolean | void)[] = [],

// 是否正在收集字符串类型的值
stringStack: (boolean | void)[] = [],

nodeGenerator = {},

RENDER_EXPRESSION_IDENTIFIER = 'a',

RENDER_EXPRESSION_MEMBER_KEYPATH = 'b',

RENDER_EXPRESSION_MEMBER_LITERAL = 'c',

RENDER_EXPRESSION_CALL = 'd',

RENDER_TEXT_VNODE = 'e',

RENDER_ATTRIBUTE_VNODE = 'f',

RENDER_PROPERTY_VNODE = 'g',

RENDER_LAZY_VNODE = 'h',

RENDER_TRANSITION_VNODE = 'i',

RENDER_BINDING_VNODE = 'j',

RENDER_MODEL_VNODE = 'k',

RENDER_EVENT_METHOD_VNODE = 'l',

RENDER_EVENT_NAME_VNODE = 'm',

RENDER_DIRECTIVE_VNODE = 'n',

RENDER_SPREAD_VNODE = 'o',

RENDER_COMMENT_VNODE = 'p',

RENDER_ELEMENT_VNODE = 'q',

RENDER_COMPONENT_VNODE = 'r',

RENDER_SLOT = 's',

RENDER_PARTIAL = 't',

RENDER_IMPORT = 'u',

RENDER_EACH = 'v',

RENDER_RANGE = 'w',

RENDER_EQUAL_RANGE = 'x',

ARG_STACK = 'y'

function renderExpression(expr: ExpressionNode, holder?: boolean, depIgnore?: boolean, stack?: string) {
  return exprGenerator.generate(
    expr,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_KEYPATH,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    holder,
    depIgnore,
    stack
  )
}

function stringifyObject(obj: object): string {
  const fields: string[] = []
  object.each(
    obj,
    function (value: any, key: string) {
      if (isDef(value)) {
        array.push(
          fields,
          generator.toString(key) + generator.COLON + value
        )
      }
    }
  )
  return generator.toObject(fields)
}

function stringifyFunction(result: string | void, arg?: string): string {
  return `${constant.RAW_FUNCTION}(${arg || constant.EMPTY_STRING}){${result || constant.EMPTY_STRING}}`
}

function stringifyExpressionVnode(expr: ExpressionNode): string {
  return generator.toCall(
    RENDER_TEXT_VNODE,
    [
      renderExpression(expr)
    ]
  )
}

function stringifyExpressionArg(expr: ExpressionNode): string {
  return renderExpression(expr, constant.FALSE, constant.FALSE, ARG_STACK)
}

function stringifyValue(value: any, expr: ExpressionNode | void, children: Node[] | void): string | void {
  if (isDef(value)) {
    return generator.toString(value)
  }
  // 只有一个表达式时，保持原始类型
  if (expr) {
    return renderExpression(expr)
  }
  // 多个值拼接时，要求是字符串
  if (children) {
    // 常见的应用场景是序列化 HTML 元素属性值，处理值时要求字符串，在处理属性名这个级别，不要求字符串
    // compiler 会把原始字符串编译成 value
    // compiler 会把单个插值编译成 expr
    // 因此走到这里，一定是多个插值或是单个特殊插值（比如 If)
    array.push(stringStack, constant.TRUE)
    const result = stringifyChildren(children)
    array.pop(stringStack)
    return result
  }
}

function stringifyChildren(children: Node[]) {

  const items = children.map(
    function (child: Node) {
      return nodeGenerator[child.type](child)
    }
  )

  // 字符串拼接涉及表达式的优先级问题，这里先统一成数组，字符串拼接改成 array.join 有利于一致性

  return array.last(stringStack) && items.length > 1
    ? generator.toArray(items) + `.join(${generator.EMPTY})`
    : array.join(items, generator.COMMA)

}

function stringifyIf(node: If | ElseIf) {

  let { children, next } = node,

  // 是否正在收集子节点
  defaultValue = array.last(collectStack)
    ? generator.toCall(RENDER_COMMENT_VNODE)
    // 要求是字符串
    : array.last(stringStack)
      ? generator.EMPTY
      : generator.UNDEFINED,

  yes: string | void,

  no: string | void

  if (children) {
    yes = stringifyChildren(children)
  }

  if (next) {
    if (next.type === nodeType.ELSE_IF) {
      no = stringifyIf(next as ElseIf)
    }
    else if (next.children) {
      no = stringifyChildren(next.children)
    }
  }

  if (!yes && !no) {
    return defaultValue
  }

  // 虽然三元表达式优先级最低，但无法保证表达式内部没有 ,
  // 因此每一个分支都要调用 toGroup
  return generator.toGroup(renderExpression(node.expr))
    + generator.QUESTION
    + generator.toGroup(yes || defaultValue)
    + generator.COLON
    + generator.toGroup(no || defaultValue)

}

function getComponentSlots(children: Node[]): string | void {

  const result: Record<string, string> = {},

  slots: Record<string, Node[]> = {},

  addSlot = function (name: string, nodes: Node[] | void) {

    if (!array.falsy(nodes)) {
      name = SLOT_DATA_PREFIX + name
      array.push(
        slots[name] || (slots[name] = []),
        nodes as Node[]
      )
    }

  }

  array.each(
    children,
    function (child) {
      // 找到具名 slot
      if (child.type === nodeType.ELEMENT) {
        const element = child as Element
        if (element.slot) {
          addSlot(
            element.slot,
            element.tag === constant.RAW_TEMPLATE
              ? element.children
              : [element]
          )
          return
        }
      }

      // 匿名 slot，名称统一为 children
      addSlot(SLOT_NAME_DEFAULT, [child])

    }
  )

  object.each(
    slots,
    function (children, name) {
      result[name] = stringifyFunction(
        stringifyChildren(children)
      )
    }
  )

  if (!object.falsy(result)) {
    return stringifyObject(result)
  }

}

nodeGenerator[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, dynamicTag, isComponent, ref, key, html, attrs, children } = node,

  outputTag: string | void,

  outputAttrs: string | void,

  outputHTML: string | void,

  outputChilds: string | void,
  outputSlots: string | void,

  outputStatic: string | void,
  outputOption: string | void,
  outputStyle: string | void,
  outputSvg: string | void,

  outputRef: string | void,
  outputKey: string | void

  if (tag === constant.RAW_SLOT) {
    const args = [generator.toString(SLOT_DATA_PREFIX + node.name)]
    if (children) {
      array.push(
        args,
        stringifyFunction(
          stringifyChildren(children)
        )
      )
    }
    return generator.toCall(RENDER_SLOT, args)
  }

  // 如果是动态组件，tag 会是一个标识符表达式
  outputTag = dynamicTag
    ? renderExpression(dynamicTag)
    : generator.toString(tag)




  array.push(collectStack, constant.FALSE)

  // 在 collectStack 为 false 时取值
  outputRef = ref ? stringifyValue(ref.value, ref.expr, ref.children) : constant.UNDEFINED
  outputKey = key ? stringifyValue(key.value, key.expr, key.children) : constant.UNDEFINED

  if (attrs) {
    const list: string[] = []
    array.each(
      attrs,
      function (attr) {
        array.push(
          list,
          nodeGenerator[attr.type](attr)
        )
      }
    )
    if (list.length) {
      outputAttrs = stringifyFunction(
        array.join(list, generator.COMMA)
      )
    }
  }

  if (children) {
    collectStack[collectStack.length - 1] = constant.TRUE
    if (isComponent) {
      outputSlots = getComponentSlots(children)
    }
    else {
      outputChilds = stringifyFunction(
        stringifyChildren(children)
      )
    }
  }

  array.pop(collectStack)



  if (html) {
    outputHTML = is.string(html)
      ? generator.toString(html as string)
      : renderExpression(html as ExpressionNode)
  }

  outputStatic = node.isStatic ? generator.TRUE : constant.UNDEFINED
  outputOption = node.isOption ? generator.TRUE : constant.UNDEFINED
  outputStyle = node.isStyle ? generator.TRUE : constant.UNDEFINED
  outputSvg = node.isSvg ? generator.TRUE : constant.UNDEFINED

  if (isComponent) {
    return generator.toCall(
      RENDER_COMPONENT_VNODE,
      // 最常用 => 最不常用排序
      [
        outputTag,
        outputAttrs,
        outputSlots,
        outputRef,
        outputKey,
      ]
    )
  }

  return generator.toCall(
    RENDER_ELEMENT_VNODE,
    // 最常用 => 最不常用排序
    [
      outputTag,
      outputAttrs,
      outputChilds,
      outputStatic,
      outputOption,
      outputStyle,
      outputSvg,
      outputHTML,
      outputRef,
      outputKey,
    ]
  )

}

nodeGenerator[nodeType.ATTRIBUTE] = function (node: Attribute): string {

  const value = node.binding
    ? generator.toCall(
      RENDER_BINDING_VNODE,
      [
        generator.toString(node.name),
        renderExpression(node.expr as ExpressionNode, constant.TRUE, constant.TRUE)
      ]
    )
    : stringifyValue(node.value, node.expr, node.children)

  return generator.toCall(
    RENDER_ATTRIBUTE_VNODE,
    [
      generator.toString(node.name),
      value
    ]
  )

}

nodeGenerator[nodeType.PROPERTY] = function (node: Property): string {

  const value = node.binding
    ? generator.toCall(
      RENDER_BINDING_VNODE,
      [
        generator.toString(node.name),
        renderExpression(node.expr as ExpressionNode, constant.TRUE, constant.TRUE),
        generator.toString(node.hint)
      ]
    )
    : stringifyValue(node.value, node.expr, node.children)

  return generator.toCall(
    RENDER_PROPERTY_VNODE,
    [
      generator.toString(node.name),
      value
    ]
  )

}

nodeGenerator[nodeType.DIRECTIVE] = function (node: Directive): string {

  const { ns, name, key, value, expr, modifier } = node

  if (ns === DIRECTIVE_LAZY) {
    return generator.toCall(
      RENDER_LAZY_VNODE,
      [
        generator.toString(name),
        generator.toString(value)
      ]
    )
  }

  // <div transition="name">
  if (ns === constant.RAW_TRANSITION) {
    return generator.toCall(
      RENDER_TRANSITION_VNODE,
      [
        generator.toString(value)
      ]
    )
  }

  // <input model="id">
  if (ns === DIRECTIVE_MODEL) {
    return generator.toCall(
      RENDER_MODEL_VNODE,
      [
        renderExpression(expr as ExpressionNode, constant.TRUE, constant.TRUE)
      ]
    )
  }

  let renderName = RENDER_DIRECTIVE_VNODE,

  args: (string | undefined)[] = [
    generator.toString(name),
    generator.toString(key),
    generator.toString(modifier),
    generator.toString(value),
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
      if (ns === DIRECTIVE_EVENT) {
        renderName = RENDER_EVENT_METHOD_VNODE
      }
      // compiler 保证了函数调用的 name 是标识符
      array.push(
        args,
        generator.toString(((expr as ExpressionCall).name as ExpressionIdentifier).name)
      )
      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy((expr as ExpressionCall).args)) {
        // args 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
        array.push(
          args,
          stringifyFunction(
            generator.RETURN + generator.toArray((expr as ExpressionCall).args.map(stringifyExpressionArg)),
            ARG_STACK
          )
        )
      }
    }
    // 不是调用方法，就是事件转换
    else if (ns === DIRECTIVE_EVENT) {
      renderName = RENDER_EVENT_NAME_VNODE
      array.push(
        args,
        generator.toString(expr.raw)
      )
    }
    else if (ns === DIRECTIVE_CUSTOM) {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        array.push(args, constant.UNDEFINED) // method
        array.push(args, constant.UNDEFINED) // args
        array.push(
          args,
          stringifyFunction(
            generator.RETURN + stringifyExpressionArg(expr),
            ARG_STACK
          )
        )
      }

    }

  }

  return generator.toCall(renderName, args)

}

nodeGenerator[nodeType.SPREAD] = function (node: Spread): string {
  return generator.toCall(
    RENDER_SPREAD_VNODE,
    [
      renderExpression(node.expr, constant.TRUE, node.binding)
    ]
  )
}

nodeGenerator[nodeType.TEXT] = function (node: Text): string {

  const result = generator.toString(node.text)

  return array.last(collectStack)
    ? generator.toCall(
        RENDER_TEXT_VNODE,
        [
          result
        ]
      )
    : result

}

nodeGenerator[nodeType.EXPRESSION] = function (node: Expression): string {

  return array.last(collectStack)
    ? stringifyExpressionVnode(node.expr)
    : renderExpression(node.expr)

}

nodeGenerator[nodeType.IF] = function (node: If): string {
  return stringifyIf(node)
}

nodeGenerator[nodeType.EACH] = function (node: Each): string {

  // compiler 保证了 children 一定有值
  const children = stringifyFunction(
    stringifyChildren(node.children as Node[])
  )

  // 遍历区间
  if (node.to) {
    if (node.equal) {
      return generator.toCall(
        RENDER_EQUAL_RANGE,
        [
          children,
          renderExpression(node.from),
          renderExpression(node.to),
          generator.toString(node.index)
        ]
      )
    }
    return generator.toCall(
      RENDER_RANGE,
      [
        children,
        renderExpression(node.from),
        renderExpression(node.to),
        generator.toString(node.index)
      ]
    )
  }

  // 遍历数组和对象
  return generator.toCall(
    RENDER_EACH,
    [
      children,
      renderExpression(node.from, constant.TRUE),
      generator.toString(node.index)
    ]
  )

}

nodeGenerator[nodeType.PARTIAL] = function (node: Partial): string {

  return generator.toCall(
    RENDER_PARTIAL,
    [
      generator.toString(node.name),
      // compiler 保证了 children 一定有值
      stringifyFunction(
        stringifyChildren(node.children as Node[])
      )
    ]
  )

}

nodeGenerator[nodeType.IMPORT] = function (node: Import): string {

  return generator.toCall(
    RENDER_IMPORT,
    [
      generator.toString(node.name)
    ]
  )

}

// 序列化代码的参数列表
let codeArgs: string | void

export function generate(node: Node): string {

  if (!codeArgs) {
    codeArgs = array.join([
      RENDER_EXPRESSION_IDENTIFIER,
      RENDER_EXPRESSION_MEMBER_KEYPATH,
      RENDER_EXPRESSION_MEMBER_LITERAL,
      RENDER_EXPRESSION_CALL,
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
      RENDER_COMMENT_VNODE,
      RENDER_ELEMENT_VNODE,
      RENDER_COMPONENT_VNODE,
      RENDER_SLOT,
      RENDER_PARTIAL,
      RENDER_IMPORT,
      RENDER_EACH,
      RENDER_RANGE,
      RENDER_EQUAL_RANGE,
    ], generator.COMMA)
  }

  return generator.toFunction(
    codeArgs,
    nodeGenerator[node.type](node)
  )

}
