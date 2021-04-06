import {
  SLOT_DATA_PREFIX,
  SLOT_NAME_DEFAULT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_EVENT,
  DIRECTIVE_TRANSITION,
  MODIFER_NATIVE,
  MAGIC_VAR_SCOPE,
  MAGIC_VAR_KEYPATH,
  MAGIC_VAR_LENGTH,
  MAGIC_VAR_EVENT,
  MAGIC_VAR_DATA,
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
import ExpressionKeypath from 'yox-expression-compiler/src/node/Keypath'
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

// 是否正在处理 attribute
attributeStack: boolean[] = [ ],

// 是否正在处理特殊 each，包括 遍历 range 和 遍历数组字面量和对象字面量
eachStack: boolean[] = [ ],

// 是否正在收集字符串类型的值
stringStack: boolean[] = [ ],

magicVariables: string[] = [ MAGIC_VAR_KEYPATH, MAGIC_VAR_LENGTH, MAGIC_VAR_EVENT, MAGIC_VAR_DATA ],

nodeGenerator = { },

RAW_METHOD = 'method'


// 下面这些值需要根据外部配置才能确定
let isUglify = constant.UNDEFINED,

// 下面 4 个变量用于分配局部变量名称
localVarId: 0,

localVarMap: Record<string, generator.Base> = { },

localVarCache: Record<string, string> = { },

VAR_LOCAL_PREFIX = constant.EMPTY_STRING,

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

DEFINE_PARTIAL = constant.EMPTY_STRING,

RENDER_PARTIAL = constant.EMPTY_STRING,

RENDER_EACH = constant.EMPTY_STRING,

RENDER_RANGE = constant.EMPTY_STRING,

RENDER_EXPRESSION_IDENTIFIER = constant.EMPTY_STRING,

RENDER_EXPRESSION_VALUE = constant.EMPTY_STRING,

EXECUTE_FUNCTION = constant.EMPTY_STRING,

TO_STRING = constant.EMPTY_STRING,

ARG_STACK = constant.EMPTY_STRING,

ARG_MAGIC_VAR_SCOPE = constant.EMPTY_STRING,

ARG_MAGIC_VAR_KEYPATH = constant.EMPTY_STRING,

ARG_MAGIC_VAR_LENGTH = constant.EMPTY_STRING,

ARG_MAGIC_VAR_EVENT = constant.EMPTY_STRING,

ARG_MAGIC_VAR_DATA = constant.EMPTY_STRING


function init() {

  if (isUglify === constant.PUBLIC_CONFIG.uglifyCompiled) {
    return
  }

  if (constant.PUBLIC_CONFIG.uglifyCompiled) {
    VAR_LOCAL_PREFIX = '_v'
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
    DEFINE_PARTIAL = '_u'
    RENDER_PARTIAL = '_v'
    RENDER_EACH = '_w'
    RENDER_RANGE = '_x'
    RENDER_EXPRESSION_IDENTIFIER = '_y'
    RENDER_EXPRESSION_VALUE = '_z'
    EXECUTE_FUNCTION = '_0'
    TO_STRING = '_1'
    ARG_STACK = '_2'
    ARG_MAGIC_VAR_SCOPE = '_3'
    ARG_MAGIC_VAR_KEYPATH = '_4'
    ARG_MAGIC_VAR_LENGTH = '_5'
    ARG_MAGIC_VAR_EVENT = '_6'
    ARG_MAGIC_VAR_DATA = '_7'
  }
  else {
    VAR_LOCAL_PREFIX = 'var'
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
    DEFINE_PARTIAL = 'definePartial'
    RENDER_PARTIAL = 'renderPartial'
    RENDER_EACH = 'renderEach'
    RENDER_RANGE = 'renderRange'
    RENDER_EXPRESSION_IDENTIFIER = 'renderExpressionIdentifier'
    RENDER_EXPRESSION_VALUE = 'renderExpressionValue'
    EXECUTE_FUNCTION = 'executeFunction'
    TO_STRING = 'toString'
    ARG_STACK = 'stack'
    ARG_MAGIC_VAR_SCOPE = MAGIC_VAR_SCOPE
    ARG_MAGIC_VAR_KEYPATH = MAGIC_VAR_KEYPATH
    ARG_MAGIC_VAR_LENGTH = MAGIC_VAR_LENGTH
    ARG_MAGIC_VAR_EVENT = MAGIC_VAR_EVENT
    ARG_MAGIC_VAR_DATA = MAGIC_VAR_DATA
  }

  isUglify = constant.PUBLIC_CONFIG.uglifyCompiled

}

function addLocalVar(value: generator.Base) {
  const hash = value.toString()
  if (localVarCache[hash]) {
    return localVarCache[hash]
  }
  const key = VAR_LOCAL_PREFIX + (localVarId++)
  localVarMap[key] = value
  localVarCache[hash] = key
  return key
}

function transformExpressionIdentifier(node: ExpressionIdentifier) {

  const { name, root, lookup, offset } = node

  // 魔法变量，直接转换
  if (array.has(magicVariables, name)) {
    switch (name) {
      case MAGIC_VAR_KEYPATH:
        return generator.toRaw(ARG_MAGIC_VAR_KEYPATH)

      case MAGIC_VAR_LENGTH:
        return generator.toRaw(ARG_MAGIC_VAR_LENGTH)

      case MAGIC_VAR_EVENT:
        return generator.toRaw(ARG_MAGIC_VAR_EVENT)

      case MAGIC_VAR_DATA:
        return generator.toRaw(ARG_MAGIC_VAR_DATA)

      default:
        return generator.toRaw(name)
    }
  }

  // this 仅在 each 中有意义
  // 这里把 this 转成 $scope，方便直接读取
  // 避免不必要的查找，提升性能
  if (array.last(eachStack)
    && root === constant.FALSE
    && lookup === constant.FALSE
    && offset === 0
  ) {

    return generator.toRaw(
      name === constant.EMPTY_STRING
        ? ARG_MAGIC_VAR_SCOPE
        : ARG_MAGIC_VAR_SCOPE
          + constant.RAW_DOT
          // 这里要把 list.0.a 转成 list[0].a
          // . 是 Yox 特有的访问数组的语法，正常的 js 语法是 [index]
          + name.replace(/\.(\d+)/g, '[$1]')
    )

  }

}

function generateHolderIfNeeded(node: generator.Base, holder?: boolean) {
  return holder
    ? node
    : generator.toOperator(
        node,
        generator.toRaw('value')
      )
}

function generateExpressionIdentifier(node: ExpressionKeypath, nodes?: generator.Base[], holder?: boolean, stack?: boolean, parentNode?: ExpressionNode) {

  let getIndex: generator.Base

  if (node.root) {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          generator.toPrimitive(0)
        )
      )
    )
  }
  else if (node.offset) {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          generator.toOperator(
            generator.toRaw(ARG_STACK),
            generator.toRaw(`length - ${1 + node.offset}`),
          ),
          [
            generator.toRaw(ARG_STACK)
          ]
        )
      )
    )
  }
  else {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          generator.toOperator(
            generator.toRaw(ARG_STACK),
            generator.toRaw(`length - 1`),
          ),
          [
            generator.toRaw(ARG_STACK)
          ]
        )
      )
    )
  }

  return generateHolderIfNeeded(
    generator.toCall(
      RENDER_EXPRESSION_IDENTIFIER,
      [
        getIndex,
        nodes
          ? generator.toList(nodes)
          : generator.toPrimitive(constant.UNDEFINED),
        node.lookup
          ? generator.toPrimitive(constant.TRUE)
          : generator.toPrimitive(constant.UNDEFINED),
        stack
          ? generator.toRaw(ARG_STACK)
          : generator.toPrimitive(constant.UNDEFINED),
        parentNode && parentNode.type === exprNodeType.CALL
          ? generator.toPrimitive(constant.TRUE)
          : generator.toPrimitive(constant.UNDEFINED)
      ]
    ),
    holder
  )

}

function generateExpressionValue(value: generator.Base, keys: generator.Base[], holder?: boolean) {

  return generateHolderIfNeeded(
    generator.toCall(
      RENDER_EXPRESSION_VALUE,
      [
        value,
        generator.toList(keys)
      ]
    ),
    holder
  )

}

function generateExpressionCall(fn: generator.Base, args?: generator.Base[], holder?: boolean) {

  return generateHolderIfNeeded(
    generator.toCall(
      EXECUTE_FUNCTION,
      [
        fn,
        args
          ? generator.toList(args)
          : generator.toPrimitive(constant.UNDEFINED)
      ]
    ),
    holder
  )

}

function generateExpression(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    transformExpressionIdentifier,
    generateExpressionIdentifier,
    generateExpressionValue,
    generateExpressionCall
  )
}

function generateExpressionHolder(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    transformExpressionIdentifier,
    generateExpressionIdentifier,
    generateExpressionValue,
    generateExpressionCall,
    constant.TRUE
  )
}

function generateExpressionArg(expr: ExpressionNode) {
  return exprGenerator.generate(
    expr,
    transformExpressionIdentifier,
    generateExpressionIdentifier,
    generateExpressionValue,
    generateExpressionCall,
    constant.FALSE,
    constant.TRUE,
  )
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

  if (result.length === 1) {
    return result[0]
  }

  // 字符串拼接涉及表达式的优先级问题，改成 array.join 有利于一致性
  if (array.last(stringStack)) {
    return generator.toOperator(
      generator.toList(
        result
      ),
      generator.toCall(
        'join',
        [
          generator.toPrimitive(constant.EMPTY_STRING)
        ]
      )
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

function parseAttrs(attrs: Node[], isComponent: boolean | void) {

  let nativeAttributeList: Attribute[] = [ ],

  nativePropertyList: Property[] = [ ],

  propertyList: Attribute[] = [ ],

  lazyList: Directive[] = [ ],

  transition: Directive | void = constant.UNDEFINED,

  model: Directive | void = constant.UNDEFINED,

  // 最后收集事件指令、自定义指令、动态属性

  eventList: Directive[ ] = [ ],

  customDirectiveList: Directive[] = [ ],

  otherList: Node[] = [ ]

  array.each(
    attrs,
    function (attr) {

      if (attr.type === nodeType.ATTRIBUTE) {
        const attributeNode = attr as Attribute
        if (isComponent) {
          array.push(
            propertyList,
            attributeNode
          )
        }
        else {
          array.push(
            nativeAttributeList,
            attributeNode
          )
        }
      }
      else if (attr.type === nodeType.PROPERTY) {
        const propertyNode = attr as Property
        array.push(
          nativePropertyList,
          propertyNode
        )
      }
      else if (attr.type === nodeType.DIRECTIVE) {
        const directiveNode = attr as Directive
        switch (directiveNode.ns) {
          case DIRECTIVE_LAZY:
            array.push(
              lazyList,
              directiveNode
            )
            break

          case DIRECTIVE_TRANSITION:
            transition = directiveNode
            break

          case DIRECTIVE_MODEL:
            model = directiveNode
            break

          case DIRECTIVE_EVENT:
            array.push(
              eventList,
              directiveNode
            )
            break

          default:
            array.push(
              customDirectiveList,
              directiveNode
            )
        }
      }
      else {
        array.push(
          otherList,
          attr
        )
      }
    }
  )

  return {
    nativeAttributeList,
    nativePropertyList,
    propertyList,
    lazyList,
    transition: transition as Directive | void,
    model: model as Directive | void,
    eventList,
    customDirectiveList,
    otherList,
  }

}

function sortAttrs(attrs: Node[], isComponent: boolean | void) {

  const {
    nativeAttributeList,
    nativePropertyList,
    propertyList,
    lazyList,
    transition,
    model,
    eventList,
    customDirectiveList,
    otherList,
  } = parseAttrs(attrs, isComponent)

  const result: Node[] = []

  array.push(result, nativeAttributeList)
  array.push(result, nativePropertyList)
  array.push(result, propertyList)
  array.push(result, lazyList)
  if (transition) {
    array.push(result, transition)
  }
  if (model) {
    array.push(result, model)
  }
  array.push(result, eventList)
  array.push(result, customDirectiveList)
  array.push(result, otherList)

  return result

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


  // 先序列化 children，再序列化 attrs，原因需要举两个例子：

  // 例子1：
  // <div on-click="output(this)"></div> 如果 this 序列化成 $scope，如果外部修改了 this，因为模板没有计入此依赖，不会刷新，因此 item 是旧的
  // 这个例子要求即使是动态执行的代码，也不能简单的直接序列化成 $scope

  // 例子2：
  // <div on-click="output(this)">{{this}}</div>，如果第一个 this 转成 $scope，第二个正常读取数据，这样肯定没问题
  // 但问题是，你不知道有没有第二个 this，因此这里反过来，先序列化非动态部分，即 children，再序列化可能动态的部分，即 attrs
  // 这样序列化动态部分的时候，就知道是否可以转成 $scope

  // 后来发现，即使这样实现也不行，因为模板里存在各种可能的 if 或三元运算，导致依赖的捕捉充满不确定，因此这里我们不再考虑把 this 转成 $scope


  array.push(vnodeStack, constant.TRUE)
  array.push(attributeStack, constant.FALSE)
  array.push(componentStack, isComponent)

  if (children) {
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

  // 开始序列化 attrs，原则也是先序列化非动态部分，再序列化动态部分，即指令留在最后序列化

  vnodeStack[vnodeStack.length - 1] = constant.FALSE
  attributeStack[attributeStack.length - 1] = constant.TRUE

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

    const {
      nativeAttributeList,
      nativePropertyList,
      propertyList,
      lazyList,
      transition,
      model,
      eventList,
      customDirectiveList,
      otherList,
    } = parseAttrs(attrs, isComponent)

    if (nativeAttributeList.length) {

      const nativeAttributes = generator.toMap()

      array.each(
        nativeAttributeList,
        function (node) {
          nativeAttributes.set(
            node.name,
            generateAttributeValue(node.value, node.expr, node.children)
          )
        }
      )

      data.set(
        field.NATIVE_ATTRIBUTES,
        nativeAttributes
      )

    }

    if (nativePropertyList.length) {

      const nativeProperties = generator.toMap()

      array.each(
        nativePropertyList,
        function (node) {
          nativeProperties.set(
            node.name,
            generateAttributeValue(node.value, node.expr, node.children)
          )
        }
      )

      data.set(
        field.NATIVE_PROPERTIES,
        nativeProperties
      )

    }

    if (propertyList.length) {

      const properties = generator.toMap()

      array.each(
        propertyList,
        function (node) {
          properties.set(
            node.name,
            generateAttributeValue(node.value, node.expr, node.children)
          )
        }
      )

      data.set(
        field.PROPERTIES,
        properties
      )

    }

    if (lazyList.length) {

      const lazy = generator.toMap()

      array.each(
        lazyList,
        function (node) {
          lazy.set(
            node.name,
            getLazyValue(node)
          )
        }
      )

      data.set(
        field.LAZY,
        lazy
      )

    }

    if (transition) {
      data.set(
        field.TRANSITION,
        generator.toCall(
          GET_TRANSITION,
          [
            getTransitionValue(transition)
          ]
        )
      )
    }

    if (model) {
      data.set(
        field.MODEL,
        generator.toCall(
          GET_MODEL,
          [
            getModelValue(model)
          ]
        )
      )
    }

    if (eventList.length) {

      const events = generator.toMap()

      array.each(
        eventList,
        function (node) {
          const params = getEventValue(node)
          events.set(
            getDirectiveKey(node),
            generator.toCall(
              params.has(RAW_METHOD)
                ? GET_EVENT_METHOD
                : GET_EVENT_NAME,
              [
                params
              ]
            )
          )
        }
      )

      data.set(
        field.EVENTS,
        events
      )

    }

    if (customDirectiveList.length) {

      const directives = generator.toMap()

      array.each(
        customDirectiveList,
        function (node) {
          directives.set(
            getDirectiveKey(node),
            generator.toCall(
              GET_DIRECTIVE,
              [
                getDirectiveValue(node)
              ]
            )
          )
        }
      )

      data.set(
        field.DIRECTIVES,
        directives
      )

    }

    if (otherList.length) {
      outputAttrs = generateNodesToList(otherList)
    }
  }

  array.pop(vnodeStack)
  array.pop(attributeStack)
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

  return isComponent
    ? generator.toCall(
        RENDER_COMPONENT_VNODE,
        [
          data,
          outputAttrs,
          outputSlots,
        ]
      )
    : generator.toCall(
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
            generator.toRaw(ARG_MAGIC_VAR_EVENT),
            generator.toRaw(ARG_MAGIC_VAR_DATA),
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
          'expr',
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

  let { children, next } = node,

  defaultValue = array.last(vnodeStack)
    ? generator.toCall(RENDER_COMMENT_VNODE)
    : generator.toPrimitive(constant.UNDEFINED),

  value: generator.Base | void

  if (children) {
    if (array.last(attributeStack)) {
      children = sortAttrs(children, array.last(componentStack))
    }
    value = generateNodesToStringIfNeeded(children)
  }

  return generator.toTernary(
    generateExpression(node.expr),
    value || defaultValue,
    next ? nodeGenerator[next.type](next) : defaultValue
  )

}

nodeGenerator[nodeType.ELSE] = function (node: Else) {

  let { children } = node,

  defaultValue = array.last(vnodeStack)
    ? generator.toCall(RENDER_COMMENT_VNODE)
    : generator.toPrimitive(constant.UNDEFINED),

  value: generator.Base | void

  if (children) {
    if (array.last(attributeStack)) {
      children = sortAttrs(children, array.last(componentStack))
    }
    value = generateNodesToStringIfNeeded(children)
  }

  return value || defaultValue

}

nodeGenerator[nodeType.EACH] = function (node: Each) {

  const { index, from, to, equal, next } = node,

  isSpecial = to || from.type === exprNodeType.ARRAY || from.type === exprNodeType.OBJECT

  const args = [
    generator.toRaw(ARG_MAGIC_VAR_KEYPATH),
    generator.toRaw(ARG_MAGIC_VAR_LENGTH),
    generator.toRaw(ARG_MAGIC_VAR_SCOPE),
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

  // 如果是特殊的 each，包括 遍历 range 和 遍历数组字面量和对象字面量
  // 在这种 each 中引用 this 无需追踪依赖，因此可直接认为 this 已用过，这样生成代码时，会直接引用局部变量，提高执行效率
  array.push(
    eachStack,
    isSpecial
  )

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

  array.pop(
    eachStack
  )

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
    DEFINE_PARTIAL,
    [
      generator.toPrimitive(node.name),
      generator.toAnonymousFunction(
        generateNodesToList(node.children as Node[]),
        [
          generator.toRaw(ARG_MAGIC_VAR_KEYPATH)
        ]
      )
    ]
  )

}

nodeGenerator[nodeType.IMPORT] = function (node: Import) {

  return generator.toCall(
    RENDER_PARTIAL,
    [
      generator.toPrimitive(node.name),
      generator.toRaw(ARG_MAGIC_VAR_KEYPATH)
    ]
  )

}

export function generate(node: Node): string {

  init()
  generator.init()

  // 重新收集
  localVarId = 0
  localVarMap = { }
  localVarCache = { }

  return generator.generate(
    nodeGenerator[node.type](node),
    localVarMap,
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
      DEFINE_PARTIAL,
      RENDER_PARTIAL,
      RENDER_EACH,
      RENDER_RANGE,
      RENDER_EXPRESSION_IDENTIFIER,
      RENDER_EXPRESSION_VALUE,
      EXECUTE_FUNCTION,
      TO_STRING,
      ARG_MAGIC_VAR_KEYPATH
    ]
  )
}
