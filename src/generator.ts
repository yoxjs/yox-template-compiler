import {
  SLOT_DATA_PREFIX,
  SLOT_NAME_DEFAULT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_TRANSITION,
  DIRECTIVE_CUSTOM,
  MODIFER_NATIVE,
} from 'yox-config/src/config'

import isDef from 'yox-common/src/function/isDef'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as object from 'yox-common/src/util/object'
import * as constant from 'yox-common/src/util/constant'
import * as generator from 'yox-common/src/util/generator'
import * as keypathUtil from 'yox-common/src/util/keypath'

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

GET_TRANSITION = 'getTransition',

RENDER_MODEL = 'renderModel',

GET_MODEL = 'getModel',

RENDER_EVENT_METHOD = 'renderEventMethod',

GET_EVENT_METHOD = 'getEventMethod',

RENDER_EVENT_NAME = 'renderEventName',

GET_EVENT_NAME = 'getEventName',

RENDER_DIRECTIVE = 'renderDirective',

GET_DIRECTIVE = 'getDirective',

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

ARG_STACK = 'argStack',

RAW_METHOD = 'method'

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
    return generator.toPrimitive(value)
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
  return generator.toPrimitive(constant.UNDEFINED)
}

function stringifyNodesToArray(nodes: Node[]) {
  return generator.toArray(
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
      : generator.toArray(
          result,
          constant.TRUE
        )
  }

  return generator.toArray(result)

}

function getComponentSlots(children: Node[]) {

  const result = generator.toObject(),

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
    : generator.toPrimitive(constant.UNDEFINED)

}

nodeGenerator[nodeType.ELEMENT] = function (node: Element) {

  let { tag, dynamicTag, isComponent, ref, key, html, text, attrs, children } = node,

  data = generator.toObject(),

  outputAttrs: generator.GBase = generator.toPrimitive(constant.UNDEFINED),
  outputChildren: generator.GBase = generator.toPrimitive(constant.UNDEFINED),
  outputSlots: generator.GBase = generator.toPrimitive(constant.UNDEFINED)

  if (tag === constant.RAW_SLOT) {
    // slot 不可能有 html、text 属性
    // 因此 slot 的子节点只存在于 children 中
    const args: generator.GBase[] = [
      generator.toPrimitive(SLOT_DATA_PREFIX + node.name)
    ]
    if (children) {
      array.push(
        args,
        generator.toAnonymousFunction(
          stringifyNodesToArray(children)
        )
      )
    }
    return generator.toCall(
      RENDER_SLOT,
      args
    )
  }

  // 如果是动态组件，tag 会是一个标识符表达式
  data.set(
    'tag',
    dynamicTag
        ? stringifyExpression(dynamicTag)
        : generator.toPrimitive(tag)
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
          ? generator.toPrimitive(html as string)
          : generator.toCall(
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
          ? generator.toPrimitive(text as string)
          : generator.toCall(
              TO_STRING,
              [
                stringifyExpression(text as ExpressionNode)
              ]
            )
    )
  }

  if (attrs) {
    // 先收集静态属性
    let nativeAttributes = generator.toObject(),

    nativeProperties = generator.toObject(),

    properties = generator.toObject(),

    directives = generator.toObject(),

    events = generator.toObject(),

    lazy = generator.toObject(),

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
        }
        else if (attr.type === nodeType.PROPERTY) {
          const propertyNode = attr as Property, value = stringifyAttributeValue(propertyNode.value, propertyNode.expr, propertyNode.children)
          nativeProperties.set(
            propertyNode.name,
            value
          )
        }
        else if (attr.type === nodeType.DIRECTIVE) {
          const directiveNode = attr as Directive
          switch (directiveNode.ns) {
            case DIRECTIVE_LAZY:
              lazy.set(
                directiveNode.name,
                getLazyValue(directiveNode)
              )
              break

            case DIRECTIVE_TRANSITION:
              data.set(
                field.TRANSITION,
                generator.toCall(
                  GET_TRANSITION,
                  [
                    getTransitionValue(directiveNode)
                  ]
                )
              )
              break

            case DIRECTIVE_MODEL:
              directives.set(
                DIRECTIVE_MODEL,
                generator.toCall(
                  GET_MODEL,
                  [
                    getModelValue(directiveNode)
                  ]
                )
              )
              break

            case DIRECTIVE_EVENT:
              const params = getEventValue(directiveNode)
              events.set(
                getDirectiveKey(directiveNode),
                generator.toCall(
                  params.has(RAW_METHOD)
                    ? GET_EVENT_METHOD
                    : GET_EVENT_NAME,
                  [
                    params
                  ]
                )
              )
              break

            default:
              directives.set(
                getDirectiveKey(directiveNode),
                generator.toCall(
                  GET_DIRECTIVE,
                  [
                    getDirectiveValue(directiveNode)
                  ]
                )
              )
          }
        }
        else {
          array.push(
            dynamicAttrs,
            attr
          )
        }
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
    if (events.isNotEmpty()) {
      data.set(
        field.EVENTS,
        events
      )
    }
    if (lazy.isNotEmpty()) {
      data.set(
        field.LAZY,
        lazy
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

      let isStatic = constant.TRUE, newChildren = generator.toArray()

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

  if (isComponent) {
    data.set(
      'isComponent',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isStatic) {
    data.set(
      'isStatic',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isOption) {
    data.set(
      'isOption',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isStyle) {
    data.set(
      'isStyle',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isSvg) {
    data.set(
      'isSvg',
      generator.toPrimitive(constant.TRUE)
    )
  }

  if (isComponent) {
    return generator.toCall(
      RENDER_COMPONENT_VNODE,
      [
        data,
        outputAttrs,
        outputSlots,
      ]
    )
  }

  return generator.toCall(
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

  return generator.toCall(
    array.last(componentStack)
      ? RENDER_PROPERTY
      : RENDER_NATIVE_ATTRIBUTE,
    [
      generator.toPrimitive(node.name),
      value
    ]
  )

}

nodeGenerator[nodeType.PROPERTY] = function (node: Property) {

  const value = stringifyAttributeValue(node.value, node.expr, node.children)

  return generator.toCall(
    RENDER_NATIVE_PROPERTY,
    [
      generator.toPrimitive(node.name),
      value
    ]
  )

}

function getLazyValue(node: Directive) {
  return generator.toPrimitive(node.value)
}

function getTransitionValue(node: Directive) {
  return generator.toPrimitive(node.value)
}

function getModelValue(node: Directive) {
  return stringifyExpressionHolder(node.expr as ExpressionNode)
}

function addCallInfo(params: any, call: ExpressionCall) {

  // compiler 保证了函数调用的 name 是标识符
  params.set(
    RAW_METHOD,
    generator.toPrimitive((call.name as ExpressionIdentifier).name)
  )

  // 为了实现运行时动态收集参数，这里序列化成函数
  if (!array.falsy(call.args)) {
    // args 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
    params.set(
      'args',
      generator.toAnonymousFunction(
        generator.toArray(call.args.map(stringifyExpressionArg)),
        [
          generator.toRaw(ARG_STACK)
        ]
      )
    )
  }

}

function getEventValue(node: Directive) {

  const params = generator.toObject()

  params.set(
    'key',
    generator.toPrimitive(getDirectiveKey(node))
  )
  params.set(
    'value',
    generator.toPrimitive(node.value)
  )
  params.set(
    'from',
    generator.toPrimitive(node.name)
  )

  if (array.last(componentStack)) {
    if (node.modifier === MODIFER_NATIVE) {
      params.set(
        'isNative',
        generator.toPrimitive(constant.TRUE)
      )
    }
    else {
      params.set(
        'isComponent',
        generator.toPrimitive(constant.TRUE)
      )
      // 组件事件要用 component.on(type, options) 进行监听
      // 为了保证 options.ns 是字符串类型，这里需确保 fromNs 是字符串
      params.set(
        'fromNs',
        generator.toPrimitive(node.modifier || constant.EMPTY_STRING)
      )
    }
  }
  else {
    params.set(
      'fromNs',
      generator.toPrimitive(node.modifier)
    )
  }

  // 事件的 expr 必须是表达式
  const expr = node.expr as ExpressionNode

  if (expr.type === exprNodeType.CALL) {
    addCallInfo(params, expr as ExpressionCall)
  }
  else {
    const parts = expr.raw.split(constant.RAW_DOT)
    params.set(
      'to',
      generator.toPrimitive(parts[0])
    )
    params.set(
      'toNs',
      generator.toPrimitive(parts[1])
    )
  }

  return params

}

function getDirectiveKey(node: Directive) {
  return keypathUtil.join(node.name, node.modifier || constant.EMPTY_STRING)
}

function getDirectiveValue(node: Directive) {

  const params = generator.toObject()

  params.set(
    'key',
    generator.toPrimitive(getDirectiveKey(node))
  )
  params.set(
    'name',
    generator.toPrimitive(node.name)
  )
  params.set(
    'modifier',
    generator.toPrimitive(node.modifier)
  )
  params.set(
    'value',
    generator.toPrimitive(node.value)
  )

  // 尽可能把表达式编译成函数，这样对外界最友好
  //
  // 众所周知，事件指令会编译成函数，对于自定义指令来说，也要尽可能编译成函数
  //
  // 比如 o-tap="method()" 或 o-log="{'id': '11'}"
  // 前者会编译成 handler（调用方法），后者会编译成 getter（取值）

  const { expr } = node

  if (expr) {

    // 如果表达式明确是在调用方法，则序列化成 method + args 的形式
    if (expr.type === exprNodeType.CALL) {
      addCallInfo(params, expr as ExpressionCall)
    }
    else {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        params.set(
          'getter',
          generator.toAnonymousFunction(
            stringifyExpressionArg(expr),
            [
              generator.toRaw(ARG_STACK)
            ]
          )
        )
      }

    }

  }

  return params

}

nodeGenerator[nodeType.DIRECTIVE] = function (node: Directive) {

  switch (node.ns) {
    case DIRECTIVE_LAZY:
      return generator.toCall(
        RENDER_LAZY,
        [
          generator.toPrimitive(node.name),
          getLazyValue(node)
        ]
      )

    // <div transition="name">
    case DIRECTIVE_TRANSITION:
      return generator.toCall(
        RENDER_TRANSITION,
        [
          getTransitionValue(node)
        ]
      )

    // <input model="id">
    case DIRECTIVE_MODEL:
      return generator.toCall(
        RENDER_MODEL,
        [
          getModelValue(node)
        ]
      )

    // <div on-click="name">
    case DIRECTIVE_EVENT:
      const params = getEventValue(node)
      return generator.toCall(
        params.has(RAW_METHOD)
          ? RENDER_EVENT_METHOD
          : RENDER_EVENT_NAME,
        [
          params
        ]
      )

    default:
      return generator.toCall(
        RENDER_DIRECTIVE,
        [
          getDirectiveValue(node)
        ]
      )
  }

}

nodeGenerator[nodeType.SPREAD] = function (node: Spread) {
  return generator.toCall(
    RENDER_SPREAD,
    [
      stringifyExpression(node.expr)
    ]
  )
}

nodeGenerator[nodeType.TEXT] = function (node: Text) {

  const result = generator.toPrimitive(node.text)

  return array.last(vnodeStack)
    ? generator.toCall(
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
    ? generator.toCall(
        RENDER_TEXT_VNODE,
        [
          generator.toCall(
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
    ? generator.toCall(RENDER_COMMENT_VNODE)
    : generator.toPrimitive(constant.UNDEFINED)

  return generator.toTernary(
    stringifyExpression(node.expr),
    (children && stringifyNodesToStringIfNeeded(children)) || defaultValue,
    next ? nodeGenerator[next.type](next) : defaultValue
  )

}

nodeGenerator[nodeType.ELSE] = function (node: Else) {

  const { children } = node,

  defaultValue = array.last(vnodeStack)
    ? generator.toCall(RENDER_COMMENT_VNODE)
    : generator.toPrimitive(constant.UNDEFINED)

  return children
    ? stringifyNodesToStringIfNeeded(children)
    : defaultValue

}

nodeGenerator[nodeType.EACH] = function (node: Each) {

  // compiler 保证了 children 一定有值
  const children = generator.toAnonymousFunction(
    stringifyNodesToArray(node.children as Node[])
  ),

  index = generator.toPrimitive(node.index)

  // 遍历区间
  if (node.to) {
    return generator.toCall(
      RENDER_RANGE,
      [
        children,
        stringifyExpression(node.from),
        stringifyExpression(node.to),
        generator.toPrimitive(node.equal),
        index
      ]
    )
  }

  // 遍历数组和对象
  return generator.toCall(
    RENDER_EACH,
    [
      children,
      stringifyExpressionHolder(node.from),
      index
    ]
  )

}

nodeGenerator[nodeType.PARTIAL] = function (node: Partial) {

  return generator.toCall(
    RENDER_PARTIAL,
    [
      generator.toPrimitive(node.name),
      generator.toAnonymousFunction(
        stringifyNodesToArray(node.children as Node[])
      )
    ]
  )

}

nodeGenerator[nodeType.IMPORT] = function (node: Import) {

  return generator.toCall(
    RENDER_IMPORT,
    [
      generator.toPrimitive(node.name)
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
      GET_TRANSITION,
      RENDER_MODEL,
      GET_MODEL,
      RENDER_EVENT_METHOD,
      GET_EVENT_METHOD,
      RENDER_EVENT_NAME,
      GET_EVENT_NAME,
      RENDER_DIRECTIVE,
      GET_DIRECTIVE,
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
