import {
  SLOT_DATA_PREFIX,
  SLOT_NAME_DEFAULT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_TRANSITION,
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
import * as field from './field'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'

import Node from './node/Node'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
import Each from './node/Each'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Else from './node/Else'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Expression from './node/Expression'
import Text from './node/Text'

// 是否正在收集虚拟节点
const vnodeStack: boolean[] = [constant.TRUE],

// 是否正在处理组件节点
componentStack: boolean[] = [],

// 是否正在收集字符串类型的值
stringStack: boolean[] = [],

nodeGenerator = {},

RENDER_EXPRESSION_IDENTIFIER = 'renderExpressionIdentifier',

RENDER_EXPRESSION_MEMBER_KEYPATH = 'renderExpressionMemberKeypath',

RENDER_EXPRESSION_MEMBER_LITERAL = 'renderExpressionMemberLiteral',

RENDER_EXPRESSION_CALL = 'renderExpressionCall',

RENDER_TEXT_VNODE = 'renderTextVnode',

RENDER_NATIVE_ATTRIBUTE = 'renderNativeAttribute',

RENDER_NATIVE_PROPERTY = 'renderNativeProperty',

RENDER_PROPERTY = 'renderProperty',

RENDER_LAZY = 'renderLazy',

RENDER_TRANSITION = 'renderTransition',

RENDER_MODEL = 'renderModel',

RENDER_EVENT_METHOD = 'renderEventMethod',

RENDER_EVENT_NAME = 'renderEventName',

RENDER_DIRECTIVE = 'renderDirective',

RENDER_SPREAD = 'renderSpread',

RENDER_COMMENT_VNODE = 'renderCommentVnode',

RENDER_ELEMENT_VNODE = 'renderElementVnode',

RENDER_COMPONENT_VNODE = 'renderComponentVnode',

RENDER_SLOT = 'renderSlot',

RENDER_PARTIAL = 'renderPartial',

RENDER_IMPORT = 'renderImport',

RENDER_EACH = 'renderEach',

RENDER_RANGE = 'renderRange',

TO_STRING = 'toString',

ARG_STACK = 'argStack'

function stringifyExpression(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_KEYPATH,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL
  )
}

function stringifyExpressionHolder(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_KEYPATH,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    constant.TRUE
  )
}

function stringifyExpressionArg(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_KEYPATH,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    constant.FALSE,
    ARG_STACK
  )
}

function stringifyAttributeValue(value: any, expr: ExpressionNode | void, children: Node[] | void) {
  if (isDef(value)) {
    return new generator.GPrimitive(value)
  }
  // 只有一个表达式时，保持原始类型
  if (expr) {
    return stringifyExpression(expr)
  }
  // 多个值拼接时，要求是字符串
  if (children) {
    // 常见的应用场景是序列化 HTML 元素属性值，处理值时要求字符串，在处理属性名这个级别，不要求字符串
    // compiler 会把原始字符串编译成 value
    // compiler 会把单个插值编译成 expr
    // 因此走到这里，一定是多个插值或是单个特殊插值（比如 If)
    array.push(stringStack, constant.TRUE)
    const result = stringifyNodesToStringIfNeeded(children)
    array.pop(stringStack)
    return result
  }
  return generator.GRAW_UNDEFINED
}

function stringifyNodesToArray(nodes: Node[]) {
  return new generator.GArray(
    nodes.map(
      function (node) {
        return nodeGenerator[node.type](node)
      }
    )
  )
}

function stringifyNodesToStringIfNeeded(children: Node[]) {

  const result = children.map(
    function (node) {
      return nodeGenerator[node.type](node)
    }
  )

  // 字符串拼接涉及表达式的优先级问题，改成 array.join 有利于一致性
  if (array.last(stringStack)) {
    return children.length === 1
      ? result[0]
      : new generator.GArray(
          result,
          constant.TRUE
        )
  }

  return new generator.GArray(result)

}

function getComponentSlots(children: Node[]) {

  const result = new generator.GObject(),

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
      // 这个步骤不能放在 compiler，因为除了 element，还会有其他节点，比如文本节点
      addSlot(SLOT_NAME_DEFAULT, [child])

    }
  )

  object.each(
    slots,
    function (children: Node[], name: string) {
      result.set(
        name,
        stringifyNodesToArray(children)
      )
    }
  )

  return result.isNotEmpty()
    ? result
    : generator.GRAW_UNDEFINED

}

nodeGenerator[nodeType.ELEMENT] = function (node: Element) {

  let { tag, dynamicTag, isComponent, ref, key, html, text, attrs, children } = node,

  data = new generator.GObject(),

  outputAttrs: generator.GBase = generator.GRAW_UNDEFINED,
  outputChildren: generator.GBase = generator.GRAW_UNDEFINED,
  outputSlots: generator.GBase = generator.GRAW_UNDEFINED

  if (tag === constant.RAW_SLOT) {
    // slot 不可能有 html、text 属性
    // 因此 slot 的子节点只存在于 children 中
    const args: generator.GBase[] = [
      new generator.GPrimitive(SLOT_DATA_PREFIX + node.name)
    ]
    if (children) {
      array.push(
        args,
        new generator.GAnonymousFunction(
          stringifyNodesToArray(children)
        )
      )
    }
    return new generator.GCall(
      RENDER_SLOT,
      args
    )
  }

  // 如果是动态组件，tag 会是一个标识符表达式
  data.set(
    'tag',
    dynamicTag
        ? stringifyExpression(dynamicTag)
        : new generator.GPrimitive(tag)
  )

  array.push(vnodeStack, constant.FALSE)
  array.push(componentStack, isComponent)

  // 在 vnodeStack 为 false 时取值
  if (ref) {
    data.set(
      'ref',
      stringifyAttributeValue(ref.value, ref.expr, ref.children)
    )
  }
  if (key) {
    data.set(
      'key',
      stringifyAttributeValue(key.value, key.expr, key.children)
    )
  }
  if (html) {
    data.set(
      'html',
      is.string(html)
          ? new generator.GPrimitive(html as string)
          : new generator.GCall(
              TO_STRING,
              [
                stringifyExpression(html as ExpressionNode)
              ]
            )
    )
  }
  if (text) {
    data.set(
      'text',
      is.string(text)
          ? new generator.GPrimitive(text as string)
          : new generator.GCall(
              TO_STRING,
              [
                stringifyExpression(text as ExpressionNode)
              ]
            )
    )
  }

  if (attrs) {
    // 先收集静态属性
    let nativeAttributes = new generator.GObject(),

    nativeProperties = new generator.GObject(),

    properties = new generator.GObject(),

    directives = new generator.GObject(),

    lazy = new generator.GObject(),

    transtion: string = constant.EMPTY_STRING,

    dynamicAttrs: any[] = []

    array.each(
      attrs,
      function (attr) {

        if (attr.type === nodeType.ATTRIBUTE) {
          const attributeNode = attr as Attribute, value = stringifyAttributeValue(attributeNode.value, attributeNode.expr, attributeNode.children)
          if (isComponent) {
            properties.set(
              attributeNode.name,
              value
            )
          }
          else {
            nativeAttributes.set(
              attributeNode.name,
              value
            )
          }
          return
        }
        else if (attr.type === nodeType.PROPERTY) {
          const propertyNode = attr as Property, value = stringifyAttributeValue(propertyNode.value, propertyNode.expr, propertyNode.children)
          nativeProperties.set(
            propertyNode.name,
            value
          )
          return
        }
        else if (attr.type === nodeType.DIRECTIVE) {
          const { ns, name, value } = attr as Directive
          if (isDef(value)) {
            if (ns === DIRECTIVE_LAZY) {
              lazy.set(
                name,
                new generator.GPrimitive(value)
              )
            }
            // transition 必须要运行时才知道 value 是什么函数
            // 编译时只知道 value 对应的函数名称，而不是运行时需要的函数
            else if (ns !== DIRECTIVE_TRANSITION) {
              directives.set(
                name,
                new generator.GPrimitive(value)
              )
            }
            return
          }
        }
        array.push(
          dynamicAttrs,
          attr
        )
      }
    )

    if (nativeAttributes.isNotEmpty()) {
      data.set(
        field.NATIVE_ATTRIBUTES,
        nativeAttributes
      )
    }
    if (nativeProperties.isNotEmpty()) {
      data.set(
        field.NATIVE_PROPERTIES,
        nativeProperties
      )
    }
    if (properties.isNotEmpty()) {
      data.set(
        field.PROPERTIES,
        properties
      )
    }
    if (directives.isNotEmpty()) {
      data.set(
        field.DIRECTIVES,
        directives
      )
    }
    if (lazy.isNotEmpty()) {
      data.set(
        field.LAZY,
        lazy
      )
    }
    if (transtion) {
      data.set(
        field.TRANSITION,
        new generator.GPrimitive(transtion)
      )
    }
    if (dynamicAttrs.length) {
      outputAttrs = stringifyNodesToArray(dynamicAttrs)
    }
  }

  if (children) {
    vnodeStack[vnodeStack.length - 1] = constant.TRUE
    if (isComponent) {
      outputSlots = getComponentSlots(children)
    }
    else {

      let isStatic = constant.TRUE, newChildren = new generator.GArray()

      array.each(
        children,
        function (node) {
          if (!node.isStatic) {
            isStatic = constant.FALSE
          }
          newChildren.push(
            nodeGenerator[node.type](node)
          )
        }
      )

      if (isStatic) {
        data.set(
          field.CHILDREN,
          newChildren
        )
      }
      else {
        outputChildren = newChildren
      }

    }
  }

  array.pop(vnodeStack)
  array.pop(componentStack)

  // 减少一次运行时赋值
  if (isComponent) {
    data.set(
      'isComponent',
      generator.GRAW_TRUE
    )
  }
  if (node.isStatic) {
    data.set(
      'isStatic',
      generator.GRAW_TRUE
    )
  }
  if (node.isOption) {
    data.set(
      'isOption',
      generator.GRAW_TRUE
    )
  }
  if (node.isStyle) {
    data.set(
      'isStyle',
      generator.GRAW_TRUE
    )
  }
  if (node.isSvg) {
    data.set(
      'isSvg',
      generator.GRAW_TRUE
    )
  }

  if (isComponent) {
    return new generator.GCall(
      RENDER_COMPONENT_VNODE,
      [
        data,
        outputAttrs,
        outputSlots,
      ]
    )
  }

  return new generator.GCall(
    RENDER_ELEMENT_VNODE,
    [
      data,
      outputAttrs,
      outputChildren,
    ]
  )

}

nodeGenerator[nodeType.ATTRIBUTE] = function (node: Attribute) {

  const value = stringifyAttributeValue(node.value, node.expr, node.children)

  return new generator.GCall(
    array.last(componentStack)
      ? RENDER_PROPERTY
      : RENDER_NATIVE_ATTRIBUTE,
    [
      new generator.GPrimitive(node.name),
      value
    ]
  )

}

nodeGenerator[nodeType.PROPERTY] = function (node: Property) {

  const value = stringifyAttributeValue(node.value, node.expr, node.children)

  return new generator.GCall(
    RENDER_NATIVE_PROPERTY,
    [
      new generator.GPrimitive(node.name),
      value
    ]
  )

}

nodeGenerator[nodeType.DIRECTIVE] = function (node: Directive) {

  const { ns, name, key, value, expr, modifier } = node

  if (ns === DIRECTIVE_LAZY) {
    return new generator.GCall(
      RENDER_LAZY,
      [
        new generator.GPrimitive(name),
        new generator.GPrimitive(value)
      ]
    )
  }

  // <div transition="name">
  if (ns === DIRECTIVE_TRANSITION) {
    return new generator.GCall(
      RENDER_TRANSITION,
      [
        new generator.GPrimitive(value)
      ]
    )
  }

  // <input model="id">
  if (ns === DIRECTIVE_MODEL) {
    return new generator.GCall(
      RENDER_MODEL,
      [
        stringifyExpressionHolder(expr as ExpressionNode)
      ]
    )
  }

  let renderName = RENDER_DIRECTIVE,

  args: generator.GBase[] = [
    new generator.GPrimitive(name),
    new generator.GPrimitive(key),
    new generator.GPrimitive(modifier),
    new generator.GPrimitive(value),
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
        renderName = RENDER_EVENT_METHOD
      }
      // compiler 保证了函数调用的 name 是标识符
      array.push(
        args,
        new generator.GPrimitive(((expr as ExpressionCall).name as ExpressionIdentifier).name)
      )
      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy((expr as ExpressionCall).args)) {
        // args 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
        array.push(
          args,
          new generator.GAnonymousFunction(
            new generator.GArray((expr as ExpressionCall).args.map(stringifyExpressionArg)),
            [
              new generator.GRaw(ARG_STACK)
            ]
          )
        )
      }
    }
    // 不是调用方法，就是事件转换
    else if (ns === DIRECTIVE_EVENT) {
      renderName = RENDER_EVENT_NAME
      array.push(
        args,
        new generator.GPrimitive(expr.raw)
      )
    }
    else if (ns === DIRECTIVE_CUSTOM) {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        args.push(
          generator.GRAW_UNDEFINED, // method
          generator.GRAW_UNDEFINED, // args
          new generator.GAnonymousFunction(
            stringifyExpressionArg(expr),
            [
              new generator.GRaw(ARG_STACK)
            ]
          )
        )
      }

    }

  }

  return new generator.GCall(
    renderName,
    args
  )

}

nodeGenerator[nodeType.SPREAD] = function (node: Spread) {
  return new generator.GCall(
    RENDER_SPREAD,
    [
      stringifyExpression(node.expr)
    ]
  )
}

nodeGenerator[nodeType.TEXT] = function (node: Text) {

  const result = new generator.GPrimitive(node.text)

  return array.last(vnodeStack)
    ? new generator.GCall(
        RENDER_TEXT_VNODE,
        [
          result
        ]
      )
    : result

}

nodeGenerator[nodeType.EXPRESSION] = function (node: Expression) {

  const result = stringifyExpression(node.expr)

  return array.last(vnodeStack)
    ? new generator.GCall(
        RENDER_TEXT_VNODE,
        [
          new generator.GCall(
            TO_STRING,
            [
              result
            ]
          )
        ]
      )
    : result

}

nodeGenerator[nodeType.IF] =
nodeGenerator[nodeType.ELSE_IF] = function (node: If | ElseIf) {

  const { children, next } = node,

  defaultValue = array.last(vnodeStack)
    ? new generator.GCall(RENDER_COMMENT_VNODE)
    : generator.GRAW_UNDEFINED

  return new generator.GTernary(
    stringifyExpression(node.expr),
    (children && stringifyNodesToStringIfNeeded(children)) || defaultValue,
    next ? nodeGenerator[next.type](next) : defaultValue
  )

}

nodeGenerator[nodeType.ELSE] = function (node: Else) {

  const { children } = node,

  defaultValue = array.last(vnodeStack)
    ? new generator.GCall(RENDER_COMMENT_VNODE)
    : generator.GRAW_UNDEFINED

  return children
    ? stringifyNodesToStringIfNeeded(children)
    : defaultValue

}

nodeGenerator[nodeType.EACH] = function (node: Each) {

  // compiler 保证了 children 一定有值
  const children = new generator.GAnonymousFunction(
    stringifyNodesToArray(node.children as Node[])
  ),

  index = new generator.GPrimitive(node.index)

  // 遍历区间
  if (node.to) {
    return new generator.GCall(
      RENDER_RANGE,
      [
        children,
        stringifyExpression(node.from),
        stringifyExpression(node.to),
        new generator.GPrimitive(node.equal),
        index
      ]
    )
  }

  // 遍历数组和对象
  return new generator.GCall(
    RENDER_EACH,
    [
      children,
      stringifyExpressionHolder(node.from),
      index
    ]
  )

}

nodeGenerator[nodeType.PARTIAL] = function (node: Partial) {

  return new generator.GCall(
    RENDER_PARTIAL,
    [
      new generator.GPrimitive(node.name),
      new generator.GAnonymousFunction(
        stringifyNodesToArray(node.children as Node[])
      )
    ]
  )

}

nodeGenerator[nodeType.IMPORT] = function (node: Import) {

  return new generator.GCall(
    RENDER_IMPORT,
    [
      new generator.GPrimitive(node.name)
    ]
  )

}

export function generate(node: Node): string {
  return generator.generate(
    nodeGenerator[node.type](node),
    [
      RENDER_EXPRESSION_IDENTIFIER,
      RENDER_EXPRESSION_MEMBER_KEYPATH,
      RENDER_EXPRESSION_MEMBER_LITERAL,
      RENDER_EXPRESSION_CALL,
      RENDER_TEXT_VNODE,
      RENDER_NATIVE_ATTRIBUTE,
      RENDER_NATIVE_PROPERTY,
      RENDER_PROPERTY,
      RENDER_LAZY,
      RENDER_TRANSITION,
      RENDER_MODEL,
      RENDER_EVENT_METHOD,
      RENDER_EVENT_NAME,
      RENDER_DIRECTIVE,
      RENDER_SPREAD,
      RENDER_COMMENT_VNODE,
      RENDER_ELEMENT_VNODE,
      RENDER_COMPONENT_VNODE,
      RENDER_SLOT,
      RENDER_PARTIAL,
      RENDER_IMPORT,
      RENDER_EACH,
      RENDER_RANGE,
      TO_STRING,
    ]
  )
}
