import {
  SLOT_DATA_PREFIX,
  SLOT_NAME_DEFAULT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_TRANSITION,
  MODIFER_NATIVE,
  MAGIC_VAR_KEYPATH,
  MAGIC_VAR_LENGTH,
  MAGIC_VAR_EVENT,
  MAGIC_VAR_DATA,
  MAGIC_VAR_ITEM,
  PUBLIC_CONFIG,
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
const vnodeStack: boolean[] = [ constant.TRUE ],

// 是否正在处理组件节点
componentStack: boolean[] = [ ],

// 是否正在处理特殊 each，包括 遍历 range 和 遍历数组字面量和对象字面量
specialEachStack: boolean[] = [ ],

// 是否正在收集字符串类型的值
stringStack: boolean[] = [ ],

magicVariables: string[] = [ MAGIC_VAR_KEYPATH, MAGIC_VAR_LENGTH, MAGIC_VAR_EVENT, MAGIC_VAR_DATA ],

nodeGenerator = { },

RAW_METHOD = 'method'


// 下面这些值需要根据外部配置才能确定
let isUglify = constant.UNDEFINED,

isRuntimeExpression = constant.FALSE,

RENDER_ELEMENT_VNODE = constant.EMPTY_STRING,

RENDER_COMPONENT_VNODE = constant.EMPTY_STRING,

RENDER_NATIVE_ATTRIBUTE = constant.EMPTY_STRING,

RENDER_NATIVE_PROPERTY = constant.EMPTY_STRING,

RENDER_PROPERTY = constant.EMPTY_STRING,

RENDER_LAZY = constant.EMPTY_STRING,

RENDER_TRANSITION = constant.EMPTY_STRING,

GET_TRANSITION = constant.EMPTY_STRING,

RENDER_MODEL = constant.EMPTY_STRING,

GET_MODEL = constant.EMPTY_STRING,

RENDER_EVENT_METHOD = constant.EMPTY_STRING,

GET_EVENT_METHOD = constant.EMPTY_STRING,

RENDER_EVENT_NAME = constant.EMPTY_STRING,

GET_EVENT_NAME = constant.EMPTY_STRING,

RENDER_DIRECTIVE = constant.EMPTY_STRING,

GET_DIRECTIVE = constant.EMPTY_STRING,

RENDER_SPREAD = constant.EMPTY_STRING,

RENDER_TEXT_VNODE = constant.EMPTY_STRING,

RENDER_COMMENT_VNODE = constant.EMPTY_STRING,

RENDER_SLOT = constant.EMPTY_STRING,

RENDER_PARTIAL = constant.EMPTY_STRING,

RENDER_IMPORT = constant.EMPTY_STRING,

RENDER_EACH = constant.EMPTY_STRING,

RENDER_RANGE = constant.EMPTY_STRING,

RENDER_EXPRESSION_IDENTIFIER = constant.EMPTY_STRING,

RENDER_EXPRESSION_MEMBER_LITERAL = constant.EMPTY_STRING,

RENDER_EXPRESSION_CALL = constant.EMPTY_STRING,

RENDER_MAGIC_VAR_KEYPATH = constant.EMPTY_STRING,

RENDER_MAGIC_VAR_LENGTH = constant.EMPTY_STRING,

RENDER_MAGIC_VAR_EVENT = constant.EMPTY_STRING,

RENDER_MAGIC_VAR_DATA = constant.EMPTY_STRING,

RENDER_MAGIC_VAR_ITEM = constant.EMPTY_STRING,

TO_STRING = constant.EMPTY_STRING,

ARG_STACK = constant.EMPTY_STRING


function init() {

  if (isUglify === PUBLIC_CONFIG.uglifyCompiled) {
    return
  }

  if (PUBLIC_CONFIG.uglifyCompiled) {
    RENDER_ELEMENT_VNODE = '_a'
    RENDER_COMPONENT_VNODE = '_b'
    RENDER_NATIVE_ATTRIBUTE = '_c'
    RENDER_NATIVE_PROPERTY = '_d'
    RENDER_PROPERTY = '_e'
    RENDER_LAZY = '_f'
    RENDER_TRANSITION = '_g'
    GET_TRANSITION = '_h'
    RENDER_MODEL = '_i'
    GET_MODEL = '_j'
    RENDER_EVENT_METHOD = '_k'
    GET_EVENT_METHOD = '_l'
    RENDER_EVENT_NAME = '_m'
    GET_EVENT_NAME = '_n'
    RENDER_DIRECTIVE = '_o'
    GET_DIRECTIVE = '_p'
    RENDER_SPREAD = '_q'
    RENDER_TEXT_VNODE = '_r'
    RENDER_COMMENT_VNODE = '_s'
    RENDER_SLOT = '_t'
    RENDER_PARTIAL = '_u'
    RENDER_IMPORT = '_v'
    RENDER_EACH = '_w'
    RENDER_RANGE = '_x'
    RENDER_EXPRESSION_IDENTIFIER = '_y'
    RENDER_EXPRESSION_MEMBER_LITERAL = '_z'
    RENDER_EXPRESSION_CALL = '_1'
    RENDER_MAGIC_VAR_KEYPATH = '_2'
    RENDER_MAGIC_VAR_LENGTH = '_3'
    RENDER_MAGIC_VAR_EVENT = '_4'
    RENDER_MAGIC_VAR_DATA = '_5'
    RENDER_MAGIC_VAR_ITEM = '_6'
    TO_STRING = '_7'
    ARG_STACK = '_8'
  }
  else {
    RENDER_ELEMENT_VNODE = 'renderElementVnode'
    RENDER_COMPONENT_VNODE = 'renderComponentVnode'
    RENDER_NATIVE_ATTRIBUTE = 'renderNativeAttribute'
    RENDER_NATIVE_PROPERTY = 'renderNativeProperty'
    RENDER_PROPERTY = 'renderProperty'
    RENDER_LAZY = 'renderLazy'
    RENDER_TRANSITION = 'renderTransition'
    GET_TRANSITION = 'getTransition'
    RENDER_MODEL = 'renderModel'
    GET_MODEL = 'getModel'
    RENDER_EVENT_METHOD = 'renderEventMethod'
    GET_EVENT_METHOD = 'getEventMethod'
    RENDER_EVENT_NAME = 'renderEventName'
    GET_EVENT_NAME = 'getEventName'
    RENDER_DIRECTIVE = 'renderDirective'
    GET_DIRECTIVE = 'getDirective'
    RENDER_SPREAD = 'renderSpread'
    RENDER_TEXT_VNODE = 'renderTextVnode'
    RENDER_COMMENT_VNODE = 'renderCommentVnode'
    RENDER_SLOT = 'renderSlot'
    RENDER_PARTIAL = 'renderPartial'
    RENDER_IMPORT = 'renderImport'
    RENDER_EACH = 'renderEach'
    RENDER_RANGE = 'renderRange'
    RENDER_EXPRESSION_IDENTIFIER = 'renderExpressionIdentifier'
    RENDER_EXPRESSION_MEMBER_LITERAL = 'renderExpressionMemberLiteral'
    RENDER_EXPRESSION_CALL = 'renderExpressionCall'
    RENDER_MAGIC_VAR_KEYPATH = MAGIC_VAR_KEYPATH
    RENDER_MAGIC_VAR_LENGTH = MAGIC_VAR_LENGTH
    RENDER_MAGIC_VAR_EVENT = MAGIC_VAR_EVENT
    RENDER_MAGIC_VAR_DATA = MAGIC_VAR_DATA
    RENDER_MAGIC_VAR_ITEM = MAGIC_VAR_ITEM
    TO_STRING = 'toString'
    ARG_STACK = 'stack'
  }

  isUglify = PUBLIC_CONFIG.uglifyCompiled

}

function transformIdentifier(node: ExpressionIdentifier) {

  const { name } = node

  // 魔法变量，直接转换
  if (array.has(magicVariables, name)) {
    switch (name) {
      case MAGIC_VAR_KEYPATH:
        return generator.toRaw(RENDER_MAGIC_VAR_KEYPATH)

      case MAGIC_VAR_LENGTH:
        return generator.toRaw(RENDER_MAGIC_VAR_LENGTH)

      case MAGIC_VAR_EVENT:
        return generator.toRaw(RENDER_MAGIC_VAR_EVENT)

      case MAGIC_VAR_DATA:
        return generator.toRaw(RENDER_MAGIC_VAR_DATA)

      default:
        return generator.toRaw(name)
    }
  }

  // 把 this 转成 $item，方便直接读取
  // 避免不必要的查找，提升性能
  if ((array.last(specialEachStack) || isRuntimeExpression)
    && node.root === constant.FALSE
    && node.lookup === constant.FALSE
    && node.offset === 0
  ) {
    return name === constant.EMPTY_STRING
      ? generator.toRaw(RENDER_MAGIC_VAR_ITEM)
      : generator.toRaw(RENDER_MAGIC_VAR_ITEM + '.' + name)
  }

}

function generateExpression(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    transformIdentifier,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL
  )
}

function generateExpressionHolder(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    transformIdentifier,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    constant.TRUE
  )
}

function generateExpressionArg(expr: ExpressionNode) {
  isRuntimeExpression = constant.TRUE
  const result = exprGenerator.generate(
    expr,
    transformIdentifier,
    RENDER_EXPRESSION_IDENTIFIER,
    RENDER_EXPRESSION_MEMBER_LITERAL,
    RENDER_EXPRESSION_CALL,
    constant.FALSE,
    ARG_STACK
  )
  isRuntimeExpression = constant.FALSE
  return result
}

function generateAttributeValue(value: any, expr: ExpressionNode | void, children: Node[] | void) {
  if (isDef(value)) {
    return generator.toPrimitive(value)
  }
  // 只有一个表达式时，保持原始类型
  if (expr) {
    return generateExpression(expr)
  }
  // 多个值拼接时，要求是字符串
  if (children) {
    // 常见的应用场景是序列化 HTML 元素属性值，处理值时要求字符串，在处理属性名这个级别，不要求字符串
    // compiler 会把原始字符串编译成 value
    // compiler 会把单个插值编译成 expr
    // 因此走到这里，一定是多个插值或是单个特殊插值（比如 If)
    array.push(stringStack, constant.TRUE)
    const result = generateNodesToStringIfNeeded(children)
    array.pop(stringStack)
    return result
  }
  return generator.toPrimitive(constant.UNDEFINED)
}

function generateNodesToList(nodes: Node[]) {
  return generator.toList(
    nodes.map(
      function (node) {
        return nodeGenerator[node.type](node)
      }
    )
  )
}

function generateNodesToStringIfNeeded(children: Node[]) {

  const result = children.map(
    function (node) {
      return nodeGenerator[node.type](node)
    }
  )

  // 字符串拼接涉及表达式的优先级问题，改成 array.join 有利于一致性
  if (array.last(stringStack)) {
    return children.length === 1
      ? result[0]
      : generator.toList(
          result,
          generator.JOIN_EMPTY
        )
  }

  return generator.toList(result)

}

function generateComponentSlots(children: Node[]) {

  const result = generator.toMap(),

  slots: Record<string, Node[]> = { },

  addSlot = function (name: string, nodes: Node[] | void) {

    if (!array.falsy(nodes)) {
      name = SLOT_DATA_PREFIX + name
      array.push(
        slots[name] || (slots[name] = [ ]),
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
        generateNodesToList(children)
      )
    }
  )

  return result.isNotEmpty()
    ? result
    : generator.toPrimitive(constant.UNDEFINED)

}

nodeGenerator[nodeType.ELEMENT] = function (node: Element) {

  let { tag, dynamicTag, isComponent, ref, key, html, text, attrs, children } = node,

  data = generator.toMap(),

  outputAttrs: generator.Base = generator.toPrimitive(constant.UNDEFINED),
  outputChildren: generator.Base = generator.toPrimitive(constant.UNDEFINED),
  outputSlots: generator.Base = generator.toPrimitive(constant.UNDEFINED)

  if (tag === constant.RAW_SLOT) {
    // slot 不可能有 html、text 属性
    // 因此 slot 的子节点只存在于 children 中
    const args: generator.Base[] = [
      generator.toPrimitive(SLOT_DATA_PREFIX + node.name)
    ]
    if (children) {
      array.push(
        args,
        generator.toAnonymousFunction(
          generateNodesToList(children)
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
        ? generateExpression(dynamicTag)
        : generator.toPrimitive(tag)
  )

  array.push(vnodeStack, constant.FALSE)
  array.push(componentStack, isComponent)

  // 在 vnodeStack 为 false 时取值
  if (ref) {
    data.set(
      'ref',
      generateAttributeValue(ref.value, ref.expr, ref.children)
    )
  }
  if (key) {
    data.set(
      'key',
      generateAttributeValue(key.value, key.expr, key.children)
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
                generateExpression(html as ExpressionNode)
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
                generateExpression(text as ExpressionNode)
              ]
            )
    )
  }

  if (attrs) {
    // 先收集静态属性
    let nativeAttributes = generator.toMap(),

    nativeProperties = generator.toMap(),

    properties = generator.toMap(),

    directives = generator.toMap(),

    events = generator.toMap(),

    lazy = generator.toMap(),

    // 最后收集动态属性
    dynamicAttrs: any[] = [ ]

    array.each(
      attrs,
      function (attr) {

        if (attr.type === nodeType.ATTRIBUTE) {
          const attributeNode = attr as Attribute, value = generateAttributeValue(attributeNode.value, attributeNode.expr, attributeNode.children)
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
          const propertyNode = attr as Property, value = generateAttributeValue(propertyNode.value, propertyNode.expr, propertyNode.children)
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
              data.set(
                field.MODEL,
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
      outputAttrs = generateNodesToList(dynamicAttrs)
    }
  }

  if (children) {
    vnodeStack[vnodeStack.length - 1] = constant.TRUE
    if (isComponent) {
      outputSlots = generateComponentSlots(children)
    }
    else {

      let isStatic = constant.TRUE, newChildren = generator.toList()

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

  const value = generateAttributeValue(node.value, node.expr, node.children)

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

  const value = generateAttributeValue(node.value, node.expr, node.children)

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
  return generateExpressionHolder(node.expr as ExpressionNode)
}

function getEventValue(node: Directive) {

  const params = generator.toMap()

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
  const expr = node.expr as ExpressionNode, { raw } = expr

  if (expr.type === exprNodeType.CALL) {

    const callNode = expr as ExpressionCall

    // compiler 保证了函数调用的 name 是标识符
    params.set(
      RAW_METHOD,
      generator.toPrimitive((callNode.name as ExpressionIdentifier).name)
    )

    // 为了实现运行时动态收集参数，这里序列化成函数
    if (!array.falsy(callNode.args)) {
      const runtime = generator.toMap()
      params.set('runtime', runtime)
      runtime.set(
        'args',
        generator.toAnonymousFunction(
          generator.toList(callNode.args.map(generateExpressionArg)),
          [
            generator.toRaw(ARG_STACK),
            generator.toRaw(RENDER_MAGIC_VAR_EVENT),
            generator.toRaw(RENDER_MAGIC_VAR_DATA),
          ]
        )
      )
    }

  }
  else {
    const parts = raw.split(constant.RAW_DOT)
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

  const params = generator.toMap()

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

      const callNode = expr as ExpressionCall

      // compiler 保证了函数调用的 name 是标识符
      params.set(
        RAW_METHOD,
        generator.toPrimitive((callNode.name as ExpressionIdentifier).name)
      )

      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy(callNode.args)) {
        const runtime = generator.toMap()
        params.set('runtime', runtime)

        runtime.set(
          'args',
          generator.toAnonymousFunction(
            generator.toList(callNode.args.map(generateExpressionArg)),
            [
              generator.toRaw(ARG_STACK),
            ]
          )
        )
      }

    }
    else {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        const runtime = generator.toMap()
        params.set('runtime', runtime)

        runtime.set(
          'arg',
          generator.toAnonymousFunction(
            generateExpressionArg(expr),
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
      generateExpression(node.expr)
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

  const result = generateExpression(node.expr)

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
    generateExpression(node.expr),
    (children && generateNodesToStringIfNeeded(children)) || defaultValue,
    next ? nodeGenerator[next.type](next) : defaultValue
  )

}

nodeGenerator[nodeType.ELSE] = function (node: Else) {

  const { children } = node,

  defaultValue = array.last(vnodeStack)
    ? generator.toCall(RENDER_COMMENT_VNODE)
    : generator.toPrimitive(constant.UNDEFINED)

  return children
    ? generateNodesToStringIfNeeded(children)
    : defaultValue

}

nodeGenerator[nodeType.EACH] = function (node: Each) {

  const { index, from, to, equal, next } = node,

  isSpecial = to || from.type === exprNodeType.ARRAY || from.type === exprNodeType.OBJECT,

  args = [
    generator.toRaw(RENDER_MAGIC_VAR_KEYPATH),
    generator.toRaw(RENDER_MAGIC_VAR_LENGTH),
    generator.toRaw(RENDER_MAGIC_VAR_ITEM),
  ]

  if (index) {
    array.push(
      args,
      generator.toRaw(index)
    )
    array.push(
      magicVariables,
      index
    )
  }

  if (isSpecial) {
    array.push(
      specialEachStack,
      constant.TRUE
    )
  }

  // compiler 保证了 children 一定有值
  const renderChildren = generator.toAnonymousFunction(
    generateNodesToList(node.children as Node[]),
    args
  )

  if (index) {
    array.pop(
      magicVariables
    )
  }

  if (isSpecial) {
    array.pop(
      specialEachStack
    )
  }

  // compiler 保证了 children 一定有值
  const renderElse = next
    ? generator.toAnonymousFunction(
        generateNodesToList(next.children as Node[])
      )
    : generator.toPrimitive(constant.UNDEFINED)

  // 遍历区间
  if (to) {

    return generator.toCall(
      RENDER_RANGE,
      [
        generateExpression(from),
        generateExpression(to),
        generator.toPrimitive(equal),
        renderChildren,
        renderElse,
      ]
    )

  }

  // 遍历数组和对象
  return generator.toCall(
    RENDER_EACH,
    [
      generateExpressionHolder(from),
      renderChildren,
      renderElse,
    ]
  )

}

nodeGenerator[nodeType.PARTIAL] = function (node: Partial) {

  return generator.toCall(
    RENDER_PARTIAL,
    [
      generator.toPrimitive(node.name),
      generator.toAnonymousFunction(
        generateNodesToList(node.children as Node[])
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
  init()
  generator.init()
  return generator.generate(
    nodeGenerator[node.type](node),
    [
      RENDER_ELEMENT_VNODE,
      RENDER_COMPONENT_VNODE,
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
      RENDER_TEXT_VNODE,
      RENDER_COMMENT_VNODE,
      RENDER_SLOT,
      RENDER_PARTIAL,
      RENDER_IMPORT,
      RENDER_EACH,
      RENDER_RANGE,
      RENDER_EXPRESSION_IDENTIFIER,
      RENDER_EXPRESSION_MEMBER_LITERAL,
      RENDER_EXPRESSION_CALL,
      RENDER_MAGIC_VAR_KEYPATH,
      TO_STRING,
    ]
  )
}
