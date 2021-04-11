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

// 是否正在收集动态 child
dynamicChildrenStack: boolean[] = [ constant.TRUE ],

magicVariables: string[] = [ MAGIC_VAR_KEYPATH, MAGIC_VAR_LENGTH, MAGIC_VAR_EVENT, MAGIC_VAR_DATA ],

nodeGenerator: Record<number, (node: any) => generator.Base> = { },

FIELD_NATIVE_ATTRIBUTES = 'nativeAttrs',

FIELD_NATIVE_PROPERTIES = 'nativeProps',

FIELD_PROPERTIES = 'props',

FIELD_DIRECTIVES = 'directives',

FIELD_EVENTS = 'events',

FIELD_MODEL = 'model',

FIELD_LAZY = 'lazy',

FIELD_TRANSITION = 'transition',

FIELD_CHILDREN = 'children'


// 下面这些值需要根据外部配置才能确定
let isUglify = constant.UNDEFINED,

// 下面 4 个变量用于分配局部变量名称
localVarId = 0,

localVarMap: Record<string, generator.Base> = { },

localVarCache: Record<string, string> = { },

VAR_LOCAL_PREFIX = constant.EMPTY_STRING,

RENDER_ELEMENT_VNODE = constant.EMPTY_STRING,

RENDER_COMPONENT_VNODE = constant.EMPTY_STRING,

APPEND_ATTRIBUTE = constant.EMPTY_STRING,

APPEND_TEXT_VNODE = constant.EMPTY_STRING,

RENDER_TRANSITION = constant.EMPTY_STRING,

RENDER_MODEL = constant.EMPTY_STRING,

RENDER_EVENT_METHOD = constant.EMPTY_STRING,

RENDER_EVENT_NAME = constant.EMPTY_STRING,

RENDER_DIRECTIVE = constant.EMPTY_STRING,

RENDER_SPREAD = constant.EMPTY_STRING,

RENDER_SLOT = constant.EMPTY_STRING,

RENDER_PARTIAL = constant.EMPTY_STRING,

RENDER_EACH = constant.EMPTY_STRING,

RENDER_RANGE = constant.EMPTY_STRING,

LOOKUP_KEYPATH = constant.EMPTY_STRING,

LOOKUP_PROP = constant.EMPTY_STRING,

GET_THIS = constant.EMPTY_STRING,

GET_THIS_BY_INDEX = constant.EMPTY_STRING,

GET_PROP = constant.EMPTY_STRING,

GET_PROP_BY_INDEX = constant.EMPTY_STRING,

READ_KEYPATH = constant.EMPTY_STRING,

EXECUTE_FUNCTION = constant.EMPTY_STRING,

SET_HOLDER = constant.EMPTY_STRING,

TO_STRING = constant.EMPTY_STRING,

ARG_INSTANCE = constant.EMPTY_STRING,

ARG_FILTERS = constant.EMPTY_STRING,

ARG_GLOBAL_FILTERS = constant.EMPTY_STRING,

ARG_LOCAL_PARTIALS = constant.EMPTY_STRING,

ARG_PARTIALS = constant.EMPTY_STRING,

ARG_GLOBAL_PARTIALS = constant.EMPTY_STRING,

ARG_DIRECTIVES = constant.EMPTY_STRING,

ARG_GLOBAL_DIRECTIVES = constant.EMPTY_STRING,

ARG_TRANSITIONS = constant.EMPTY_STRING,

ARG_GLOBAL_TRANSITIONS = constant.EMPTY_STRING,

ARG_STACK = constant.EMPTY_STRING,

ARG_VNODE = constant.EMPTY_STRING,

ARG_CHILDREN = constant.EMPTY_STRING,

ARG_COMPONENTS = constant.EMPTY_STRING,

ARG_SCOPE = constant.EMPTY_STRING,

ARG_KEYPATH = constant.EMPTY_STRING,

ARG_LENGTH = constant.EMPTY_STRING,

ARG_EVENT = constant.EMPTY_STRING,

ARG_DATA = constant.EMPTY_STRING


function init() {

  if (isUglify === constant.PUBLIC_CONFIG.uglifyCompiled) {
    return
  }

  if (constant.PUBLIC_CONFIG.uglifyCompiled) {
    VAR_LOCAL_PREFIX = 'v'
    RENDER_ELEMENT_VNODE = '_a'
    RENDER_COMPONENT_VNODE = '_b'
    APPEND_ATTRIBUTE = '_c'
    APPEND_TEXT_VNODE = '_d'
    RENDER_TRANSITION = '_e'
    RENDER_MODEL = '_f'
    RENDER_EVENT_METHOD = '_g'
    RENDER_EVENT_NAME = '_h'
    RENDER_DIRECTIVE = '_i'
    RENDER_SPREAD = '_j'
    RENDER_SLOT = '_k'
    RENDER_PARTIAL = '_l'
    RENDER_EACH = '_m'
    RENDER_RANGE = '_n'
    LOOKUP_KEYPATH = '_o'
    LOOKUP_PROP = '_p'
    GET_THIS = '_q'
    GET_THIS_BY_INDEX = '_r'
    GET_PROP = '_s'
    GET_PROP_BY_INDEX = '_t'
    READ_KEYPATH = '_u'
    EXECUTE_FUNCTION = '_v'
    SET_HOLDER = '_w'
    TO_STRING = '_x'
    ARG_INSTANCE = '_y'
    ARG_FILTERS = '_z',
    ARG_GLOBAL_FILTERS = '__a',
    ARG_LOCAL_PARTIALS = '__b'
    ARG_PARTIALS = '__c',
    ARG_GLOBAL_PARTIALS = '__d',
    ARG_DIRECTIVES = '__e',
    ARG_GLOBAL_DIRECTIVES = '__f',
    ARG_TRANSITIONS = '__g',
    ARG_GLOBAL_TRANSITIONS = '__h',
    ARG_STACK = '__i'
    ARG_VNODE = '__j'
    ARG_CHILDREN = '__k'
    ARG_COMPONENTS = '__l'
    ARG_SCOPE = '__m'
    ARG_KEYPATH = '__n'
    ARG_LENGTH = '__o'
    ARG_EVENT = '__p'
    ARG_DATA = '__q'
  }
  else {
    VAR_LOCAL_PREFIX = 'var'
    RENDER_ELEMENT_VNODE = 'renderElementVnode'
    RENDER_COMPONENT_VNODE = 'renderComponentVnode'
    APPEND_ATTRIBUTE = 'appendAttribute'
    APPEND_TEXT_VNODE = 'appendTextVnode'
    RENDER_TRANSITION = 'renderTransition'
    RENDER_MODEL = 'renderModel'
    RENDER_EVENT_METHOD = 'renderEventMethod'
    RENDER_EVENT_NAME = 'renderEventName'
    RENDER_DIRECTIVE = 'renderDirective'
    RENDER_SPREAD = 'renderSpread'
    RENDER_SLOT = 'renderSlot'
    RENDER_PARTIAL = 'renderPartial'
    RENDER_EACH = 'renderEach'
    RENDER_RANGE = 'renderRange'
    LOOKUP_KEYPATH = 'lookupKeypath'
    LOOKUP_PROP = 'lookupProp'
    GET_THIS = 'getThis'
    GET_THIS_BY_INDEX = 'getThisByIndex'
    GET_PROP = 'getProp'
    GET_PROP_BY_INDEX = 'getPropByIndex'
    READ_KEYPATH = 'readKeypath'
    EXECUTE_FUNCTION = 'executeFunction'
    SET_HOLDER = 'setHolder'
    TO_STRING = 'toString'
    ARG_INSTANCE = 'instance'
    ARG_FILTERS = 'filters',
    ARG_GLOBAL_FILTERS = 'globalFilters',
    ARG_LOCAL_PARTIALS = 'localPartials'
    ARG_PARTIALS = 'partials',
    ARG_GLOBAL_PARTIALS = 'globalPartials',
    ARG_DIRECTIVES = 'directives',
    ARG_GLOBAL_DIRECTIVES = 'globalDirectives',
    ARG_TRANSITIONS = 'transition',
    ARG_GLOBAL_TRANSITIONS = 'globalTransitions',
    ARG_STACK = 'stack'
    ARG_VNODE = 'vnode'
    ARG_CHILDREN = 'children'
    ARG_COMPONENTS = 'components'
    ARG_SCOPE = MAGIC_VAR_SCOPE
    ARG_KEYPATH = MAGIC_VAR_KEYPATH
    ARG_LENGTH = MAGIC_VAR_LENGTH
    ARG_EVENT = MAGIC_VAR_EVENT
    ARG_DATA = MAGIC_VAR_DATA
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
        return generator.toRaw(ARG_KEYPATH)

      case MAGIC_VAR_LENGTH:
        return generator.toRaw(ARG_LENGTH)

      case MAGIC_VAR_EVENT:
        return generator.toRaw(ARG_EVENT)

      case MAGIC_VAR_DATA:
        return generator.toRaw(ARG_DATA)

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

    if (name === constant.EMPTY_STRING) {
      return generator.toRaw(ARG_SCOPE)
    }

    return generator.toMember(
      generator.toRaw(ARG_SCOPE),
      generator.parse(name)
    )

  }

}

function generateHolderIfNeeded(node: generator.Base, holder?: boolean) {
  return holder
    ? node
    : generator.toMember(
        node,
        [
          generator.toPrimitive('value')
        ]
      )
}

function generateExpressionIdentifier(node: ExpressionKeypath, nodes: generator.Base[], keypath?: string, holder?: boolean, stack?: boolean, parentNode?: ExpressionNode) {

  const { root, lookup, offset } = node, { length } = nodes

  let getIndex: generator.Base

  if (root) {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          constant.UNDEFINED,
          constant.UNDEFINED,
          generator.toPrimitive(0)
        )
      )
    )
  }
  else if (offset) {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          [
            generator.toRaw(ARG_STACK)
          ],
          constant.UNDEFINED,
          generator.toBinary(
            generator.toMember(
              generator.toRaw(ARG_STACK),
              [
                generator.toPrimitive('length')
              ]
            ),
            '-',
            generator.toPrimitive(1 + offset)
          )
        )
      )
    )
  }
  else {
    getIndex = generator.toRaw(
      addLocalVar(
        generator.toAnonymousFunction(
          [
            generator.toRaw(ARG_STACK)
          ],
          constant.UNDEFINED,
          generator.toBinary(
            generator.toMember(
              generator.toRaw(ARG_STACK),
              [
                generator.toPrimitive('length')
              ]
            ),
            '-',
            generator.toPrimitive(1)
          )
        )
      )
    )
  }

  let filter: generator.Base = generator.toPrimitive(constant.UNDEFINED)

  // 函数调用
  if (parentNode
    && parentNode.type === exprNodeType.CALL
    // 调用过滤器肯定无需指定路径
    && lookup
    // 过滤器名称是简单的标识符，可支持多级属性，如 lodash.toUpper
    && keypath
    && length > 0
  ) {
    if (length > 1) {
      filter = generator.toMember(
        generator.toRaw(ARG_GLOBAL_FILTERS),
        nodes
      )
    }
    else {
      filter = generateSelfAndGlobalReader(
        ARG_FILTERS,
        ARG_GLOBAL_FILTERS,
        keypath
      )
    }
  }

  let result: generator.Base = generator.toCall(
    LOOKUP_KEYPATH,
    [
      getIndex,
      is.string(keypath)
        ? generator.toPrimitive(keypath)
        : length === 1
          ? nodes[0]
          : generator.toList(nodes, constant.RAW_DOT),
      lookup
        ? generator.toPrimitive(constant.TRUE)
        : generator.toPrimitive(constant.UNDEFINED),
      stack
        ? generator.toRaw(ARG_STACK)
        : generator.toPrimitive(constant.UNDEFINED),
      filter
    ]
  )

  // 如果是读取一级属性的场景，比如 this.x，这里可以优化成 scope.x
  // 如果是读取多级属性的场景，比如 this.x.y，这里不做优化，因为 x 可能为空，导致整个表达式报错

  // 处理一级属性
  if (keypath && length === 1) {

    // this.name
    if (!root && !offset && !lookup) {
      result = generator.toCall(
        GET_PROP,
        [
          generator.toPrimitive(keypath),
          generator.toMember(
            generator.toRaw(ARG_SCOPE),
            nodes
          ),
          stack
            ? generator.toRaw(ARG_STACK)
            : generator.toPrimitive(constant.UNDEFINED)
        ]
      )
    }
    // 未指定路径，如 name
    else if (!root && !offset) {
      result = generator.toCall(
        LOOKUP_PROP,
        [
          generator.toPrimitive(keypath),
          generator.toMember(
            generator.toRaw(ARG_SCOPE),
            nodes
          ),
          stack
            ? generator.toRaw(ARG_STACK)
            : generator.toPrimitive(constant.UNDEFINED),
          filter
        ]
      )
    }
    // 指定了路径，如 ~/name 或 ../name
    else {
      result = generator.toCall(
        GET_PROP_BY_INDEX,
        [
          getIndex,
          generator.toPrimitive(keypath),
          stack
            ? generator.toRaw(ARG_STACK)
            : generator.toPrimitive(constant.UNDEFINED)
        ]
      )
    }

  }
  // 处理属性为空串，如 this、../this、~/this 之类的
  else if (!keypath && !length) {

    // this
    if (!root && !offset && !lookup) {
      result = generator.toCall(
        GET_THIS,
        [
          generator.toRaw(ARG_SCOPE),
          stack
            ? generator.toRaw(ARG_STACK)
            : generator.toPrimitive(constant.UNDEFINED)
        ]
      )
    }
    // 指定了路径，如 ~/name 或 ../name
    else if (root || offset) {
      result = generator.toCall(
        GET_THIS_BY_INDEX,
        [
          getIndex,
          stack
            ? generator.toRaw(ARG_STACK)
            : generator.toPrimitive(constant.UNDEFINED)
        ]
      )
    }

  }

  return generateHolderIfNeeded(result, holder)

}

function generateExpressionValue(value: generator.Base, keys: generator.Base[], keypath?: string, holder?: boolean) {

  let result: generator.Base

  switch (keys.length) {
    case 0:
      result = generator.toCall(
        SET_HOLDER,
        [
          value,
        ]
      )
      break
    case 1:
      result = generator.toCall(
        SET_HOLDER,
        [
          generator.toMember(
            value,
            keys
          )
        ]
      )
      break
    default:
      result = generator.toCall(
        READ_KEYPATH,
        [
          value,
          keypath
            ? generator.toPrimitive(keypath)
            : generator.toList(keys, constant.RAW_DOT)
        ]
      )
      break
  }

  return generateHolderIfNeeded(result, holder)

}

function generateExpressionCall(fn: generator.Base, args?: generator.Base[], holder?: boolean) {

  return generateHolderIfNeeded(
    generator.toCall(
      SET_HOLDER,
      [
        generator.toCall(
          EXECUTE_FUNCTION,
          [
            fn,
            generator.toRaw(ARG_INSTANCE),
            args
              ? generator.toList(args)
              : generator.toPrimitive(constant.UNDEFINED)
          ]
        )
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

function generateNodesToTuple(nodes: Node[]) {
  return generator.toTuple(
    constant.EMPTY_STRING,
    constant.EMPTY_STRING,
    ';',
    constant.TRUE,
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
    return generator.toList(
      result,
      constant.EMPTY_STRING
    )
  }

  return generator.toList(result)

}

function appendDynamicChildVnode(node: generator.Base, isTextVnode?: true) {
  if (isTextVnode) {
    return generator.toCall(
      APPEND_TEXT_VNODE,
      [
        generator.toRaw(ARG_CHILDREN),
        node,
      ]
    )
  }
  return generator.toPush(
    ARG_CHILDREN,
    node
  )
}

function appendComponentVnode(node: generator.Base) {
  return generator.toPush(
    ARG_COMPONENTS,
    node
  )
}

function generateSelfAndGlobalReader(self: string, global: string, name: string) {
  return generator.toBinary(
    generator.toBinary(
      generator.toRaw(self),
      '&&',
      generator.toMember(
        generator.toRaw(self),
        [
          generator.toPrimitive(name)
        ]
      ),
    ),
    '||',
    generator.toMember(
      generator.toRaw(global),
      [
        generator.toPrimitive(name)
      ]
    )
  )
}

function generateCommentVnode() {
  const result = generator.toMap({
    context: generator.toRaw(ARG_INSTANCE),
    isComment: generator.toPrimitive(constant.TRUE),
    text: generator.toPrimitive(constant.EMPTY_STRING),
  })
  return array.last(dynamicChildrenStack)
    ? appendDynamicChildVnode(result)
    : result
}

function generateTextVnode(text: generator.Base) {
  const result = generator.toMap({
    context: generator.toRaw(ARG_INSTANCE),
    isText: generator.toPrimitive(constant.TRUE),
    text,
  })
  return array.last(dynamicChildrenStack)
    ? appendDynamicChildVnode(result, constant.TRUE)
    : result
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
        generator.toAnonymousFunction(
          [
            generator.toRaw(ARG_CHILDREN),
            generator.toRaw(ARG_COMPONENTS)
          ],
          generateNodesToTuple(children)
        )
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
      generator.toPrimitive(SLOT_DATA_PREFIX + node.name),
      generator.toRaw(ARG_CHILDREN),
    ]
    if (children) {
      array.push(
        args,
        generator.toAnonymousFunction(
          constant.UNDEFINED,
          generateNodesToTuple(children)
        )
      )
    }
    return generator.toCall(
      RENDER_SLOT,
      args
    )
  }

  data.set(
    'context',
    generator.toRaw(ARG_INSTANCE)
  )

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

      let isDynamic = constant.FALSE

      array.each(
        children,
        function (node) {
          if (!node.isStatic) {
            isDynamic = constant.TRUE
            return constant.FALSE
          }
        }
      )

      array.push(
        dynamicChildrenStack,
        isDynamic
      )

      if (isDynamic) {
        outputChildren = generator.toAnonymousFunction(
          [
            generator.toRaw(ARG_CHILDREN)
          ],
          generateNodesToTuple(
            children
          )
        )
      }
      else {
        data.set(
          FIELD_CHILDREN,
          generator.toList(
            children.map(
              function (node) {
                return nodeGenerator[node.type](node)
              }
            )
          )
        )
      }

      array.pop(
        dynamicChildrenStack
      )

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
        FIELD_NATIVE_ATTRIBUTES,
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
        FIELD_NATIVE_PROPERTIES,
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
        FIELD_PROPERTIES,
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
        FIELD_LAZY,
        lazy
      )

    }

    if (transition) {
      data.set(
        FIELD_TRANSITION,
        getTransitionValue(transition)
      )
    }

    if (model) {
      data.set(
        FIELD_MODEL,
        getModelValue(model)
      )
    }

    if (eventList.length) {

      const events = generator.toMap()

      array.each(
        eventList,
        function (node) {
          const info = getEventInfo(node)
          events.set(
            getDirectiveKey(node),
            generator.toCall(
              info.name,
              info.args
            )
          )
        }
      )

      data.set(
        FIELD_EVENTS,
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
              RENDER_DIRECTIVE,
              getDirectiveArgs(node)
            )
          )
        }
      )

      data.set(
        FIELD_DIRECTIVES,
        directives
      )

    }

    if (otherList.length) {
      outputAttrs = generator.toAnonymousFunction(
        [
          generator.toRaw(ARG_VNODE)
        ],
        generateNodesToTuple(otherList)
      )
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

  let result: generator.Base

  if (isComponent) {
    result = generator.toCall(
      RENDER_COMPONENT_VNODE,
      [
        data,
        outputAttrs,
        outputSlots
      ]
    )
    result = appendComponentVnode(result)
  }
  else {
    result = generator.toCall(
      RENDER_ELEMENT_VNODE,
      [
        data,
        outputAttrs,
        outputChildren,
      ]
    )
  }

  return array.last(dynamicChildrenStack)
    ? appendDynamicChildVnode(result)
    : result

}

nodeGenerator[nodeType.ATTRIBUTE] = function (node: Attribute) {

  return generator.toCall(
    APPEND_ATTRIBUTE,
    [
      generator.toRaw(ARG_VNODE),
      generator.toPrimitive(
        array.last(componentStack)
          ? FIELD_PROPERTIES
          : FIELD_NATIVE_ATTRIBUTES
      ),
      generateAttributeValue(node.value, node.expr, node.children),
      generator.toPrimitive(node.name),
    ]
  )

}

nodeGenerator[nodeType.PROPERTY] = function (node: Property) {

  return generator.toCall(
    APPEND_ATTRIBUTE,
    [
      generator.toRaw(ARG_VNODE),
      generator.toPrimitive(FIELD_NATIVE_PROPERTIES),
      generateAttributeValue(node.value, node.expr, node.children),
      generator.toPrimitive(node.name),
    ]
  )

}

function getLazyValue(node: Directive) {
  return generator.toPrimitive(node.value)
}

function getTransitionValue(node: Directive) {
  return generator.toCall(
    RENDER_TRANSITION,
    [
      generator.toPrimitive(node.value),
      generateSelfAndGlobalReader(
        ARG_TRANSITIONS,
        ARG_GLOBAL_TRANSITIONS,
        node.value as string
      )
    ]
  )
}

function getModelValue(node: Directive) {
  return generator.toCall(
    RENDER_MODEL,
    [
      generateExpressionHolder(node.expr as ExpressionNode)
    ]
  )
}

function addEventBooleanInfo(args: generator.Base[], node: Directive) {

  // isComponent
  array.push(
    args,
    generator.toPrimitive(constant.UNDEFINED)
  )

  // isNative
  array.push(
    args,
    generator.toPrimitive(constant.UNDEFINED)
  )

  if (array.last(componentStack)) {
    if (node.modifier === MODIFER_NATIVE) {
      // isNative
      args[args.length - 1] = generator.toPrimitive(constant.TRUE)
    }
    else {
      // isComponent
      args[args.length - 2] = generator.toPrimitive(constant.TRUE)
    }
  }

}

function getEventInfo(node: Directive) {

  const args: generator.Base[] = [ ]

  // key
  array.push(
    args,
    generator.toPrimitive(getDirectiveKey(node))
  )
  // value
  array.push(
    args,
    generator.toPrimitive(node.value)
  )

  // from
  array.push(
    args,
    generator.toPrimitive(node.name)
  )

  // fromNs
  array.push(
    args,
    // 组件事件要用 component.on(type, options) 进行监听
    // 为了保证 options.ns 是字符串类型，这里需确保 fromNs 是字符串
    generator.toPrimitive(node.modifier || constant.EMPTY_STRING)
  )

  // 事件的 expr 必须是表达式
  const expr = node.expr as ExpressionNode, { raw } = expr

  if (expr.type === exprNodeType.CALL) {

    const callNode = expr as ExpressionCall

    // compiler 保证了函数调用的 name 是标识符
    // method
    array.push(
      args,
      generator.toPrimitive((callNode.name as ExpressionIdentifier).name)
    )

    // 为了实现运行时动态收集参数，这里序列化成函数
    if (!array.falsy(callNode.args)) {
      // runtime
      array.push(
        args,
        generator.toMap({
          args: generator.toAnonymousFunction(
            [
              generator.toRaw(ARG_STACK),
              generator.toRaw(ARG_EVENT),
              generator.toRaw(ARG_DATA),
            ],
            constant.UNDEFINED,
            generator.toList(callNode.args.map(generateExpressionArg))
          )
        })
      )
    }
    else {
      // runtime
      array.push(
        args,
        generator.toPrimitive(constant.UNDEFINED)
      )
    }

    addEventBooleanInfo(args, node)

    return {
      name: RENDER_EVENT_METHOD,
      args,
    }

  }

  const parts = raw.split(constant.RAW_DOT)

  // to
  array.push(
    args,
    generator.toPrimitive(parts[0])
  )
  // toNs
  array.push(
    args,
    generator.toPrimitive(parts[1])
  )

  addEventBooleanInfo(args, node)

  return {
    name: RENDER_EVENT_NAME,
    args,
  }

}

function getDirectiveKey(node: Directive) {
  return keypathUtil.join(node.name, node.modifier || constant.EMPTY_STRING)
}

function getDirectiveArgs(node: Directive) {

  const args: generator.Base[] = [ ]

  // key
  array.push(
    args,
    generator.toPrimitive(getDirectiveKey(node))
  )
  // name
  array.push(
    args,
    generator.toPrimitive(node.name)
  )
  // modifier
  array.push(
    args,
    generator.toPrimitive(node.modifier)
  )
  // value
  array.push(
    args,
    generator.toPrimitive(node.value)
  )
  // hooks
  array.push(
    args,
    generateSelfAndGlobalReader(
      ARG_DIRECTIVES,
      ARG_GLOBAL_DIRECTIVES,
      node.name
    )
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

      // 为了实现运行时动态收集参数，这里序列化成函数
      if (!array.falsy(callNode.args)) {
        // runtime
        array.push(
          args,
          generator.toMap({
            args: generator.toAnonymousFunction(
              [
                generator.toRaw(ARG_STACK),
              ],
              constant.UNDEFINED,
              generator.toList(callNode.args.map(generateExpressionArg))
            )
          })
        )
      }
      else {
        // runtime
        array.push(
          args,
          generator.toPrimitive(constant.UNDEFINED)
        )
      }

      // compiler 保证了函数调用的 name 是标识符
      // method
      array.push(
        args,
        generator.toPrimitive((callNode.name as ExpressionIdentifier).name)
      )

    }
    else {

      // 取值函数
      // getter 函数在触发事件时调用，调用时会传入它的作用域，因此这里要加一个参数
      if (expr.type !== exprNodeType.LITERAL) {
        // runtime
        array.push(
          args,
          generator.toMap({
            expr: generator.toAnonymousFunction(
              [
                generator.toRaw(ARG_STACK)
              ],
              constant.UNDEFINED,
              generateExpressionArg(expr)
            )
          })
        )
      }

    }

  }

  return args

}

nodeGenerator[nodeType.DIRECTIVE] = function (node: Directive) {

  switch (node.ns) {
    case DIRECTIVE_LAZY:
      return generator.toCall(
        APPEND_ATTRIBUTE,
        [
          generator.toRaw(ARG_VNODE),
          generator.toPrimitive(FIELD_LAZY),
          getLazyValue(node),
          generator.toPrimitive(node.name),
        ]
      )

    // <div transition="name">
    case DIRECTIVE_TRANSITION:
      return generator.toCall(
        APPEND_ATTRIBUTE,
        [
          generator.toRaw(ARG_VNODE),
          generator.toPrimitive(FIELD_TRANSITION),
          getTransitionValue(node),
        ]
      )

    // <input model="id">
    case DIRECTIVE_MODEL:
      return generator.toCall(
        APPEND_ATTRIBUTE,
        [
          generator.toRaw(ARG_VNODE),
          generator.toPrimitive(FIELD_MODEL),
          getModelValue(node),
        ]
      )

    // <div on-click="name">
    case DIRECTIVE_EVENT:
      const info = getEventInfo(node)
      return generator.toCall(
        APPEND_ATTRIBUTE,
        [
          generator.toRaw(ARG_VNODE),
          generator.toPrimitive(FIELD_EVENTS),
          generator.toCall(
            info.name,
            info.args
          ),
          generator.toPrimitive(getDirectiveKey(node)),
        ]
      )

    default:
      return generator.toCall(
        APPEND_ATTRIBUTE,
        [
          generator.toRaw(ARG_VNODE),
          generator.toPrimitive(FIELD_DIRECTIVES),
          generator.toCall(
            RENDER_DIRECTIVE,
            getDirectiveArgs(node)
          ),
          generator.toPrimitive(getDirectiveKey(node)),
        ]
      )
  }

}

nodeGenerator[nodeType.SPREAD] = function (node: Spread) {
  return generator.toCall(
    RENDER_SPREAD,
    [
      generator.toRaw(ARG_VNODE),
      generator.toPrimitive(FIELD_PROPERTIES),
      generateExpression(node.expr)
    ]
  )
}

nodeGenerator[nodeType.TEXT] = function (node: Text) {

  const text = generator.toPrimitive(node.text)

  return array.last(vnodeStack)
    ? generateTextVnode(text)
    : text

}

nodeGenerator[nodeType.EXPRESSION] = function (node: Expression) {

  const value = generateExpression(node.expr)

  return array.last(vnodeStack)
    ? generateTextVnode(
        generator.toCall(
          TO_STRING,
          [
            value
          ]
        )
      )
    : value

}

nodeGenerator[nodeType.IF] =
nodeGenerator[nodeType.ELSE_IF] = function (node: If | ElseIf) {

  let { children, next } = node,

  defaultValue = array.last(vnodeStack)
    ? generateCommentVnode()
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
    ? generateCommentVnode()
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
    generator.toRaw(ARG_SCOPE),
    generator.toRaw(ARG_KEYPATH),
    generator.toRaw(ARG_LENGTH),
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
    args,
    generateNodesToTuple(node.children as Node[])
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
        constant.UNDEFINED,
        generateNodesToTuple(next.children as Node[])
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

  return generator.toAssign(
    generator.toMember(
      generator.toRaw(ARG_LOCAL_PARTIALS),
      [
        generator.toPrimitive(node.name)
      ]
    ),
    generator.toAnonymousFunction(
      [
        generator.toRaw(ARG_SCOPE),
        generator.toRaw(ARG_KEYPATH),
        generator.toRaw(ARG_CHILDREN),
        generator.toRaw(ARG_COMPONENTS),
      ],
      generateNodesToTuple(node.children as Node[])
    )
  )

}

nodeGenerator[nodeType.IMPORT] = function (node: Import) {

  const { name } = node

  return generator.toCall(
    RENDER_PARTIAL,
    [
      generator.toPrimitive(name),
      generator.toRaw(ARG_SCOPE),
      generator.toRaw(ARG_KEYPATH),
      generator.toRaw(ARG_CHILDREN),
      generator.toRaw(ARG_COMPONENTS),
      generator.toMember(
        generator.toRaw(ARG_LOCAL_PARTIALS),
        [
          generator.toPrimitive(name)
        ]
      ),
      generateSelfAndGlobalReader(
        ARG_PARTIALS,
        ARG_GLOBAL_PARTIALS,
        name,
      )
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
    [
      generator.toRaw(RENDER_ELEMENT_VNODE),
      generator.toRaw(RENDER_COMPONENT_VNODE),
      generator.toRaw(APPEND_ATTRIBUTE),
      generator.toRaw(APPEND_TEXT_VNODE),
      generator.toRaw(RENDER_TRANSITION),
      generator.toRaw(RENDER_MODEL),
      generator.toRaw(RENDER_EVENT_METHOD),
      generator.toRaw(RENDER_EVENT_NAME),
      generator.toRaw(RENDER_DIRECTIVE),
      generator.toRaw(RENDER_SPREAD),
      generator.toRaw(RENDER_SLOT),
      generator.toRaw(RENDER_PARTIAL),
      generator.toRaw(RENDER_EACH),
      generator.toRaw(RENDER_RANGE),
      generator.toRaw(LOOKUP_KEYPATH),
      generator.toRaw(LOOKUP_PROP),
      generator.toRaw(GET_THIS),
      generator.toRaw(GET_THIS_BY_INDEX),
      generator.toRaw(GET_PROP),
      generator.toRaw(GET_PROP_BY_INDEX),
      generator.toRaw(READ_KEYPATH),
      generator.toRaw(EXECUTE_FUNCTION),
      generator.toRaw(SET_HOLDER),
      generator.toRaw(TO_STRING),
      generator.toRaw(ARG_INSTANCE),
      generator.toRaw(ARG_FILTERS),
      generator.toRaw(ARG_GLOBAL_FILTERS),
      generator.toRaw(ARG_LOCAL_PARTIALS),
      generator.toRaw(ARG_PARTIALS),
      generator.toRaw(ARG_GLOBAL_PARTIALS),
      generator.toRaw(ARG_DIRECTIVES),
      generator.toRaw(ARG_GLOBAL_DIRECTIVES),
      generator.toRaw(ARG_TRANSITIONS),
      generator.toRaw(ARG_GLOBAL_TRANSITIONS),
      generator.toRaw(ARG_SCOPE),
      generator.toRaw(ARG_KEYPATH),
      generator.toRaw(ARG_CHILDREN),
      generator.toRaw(ARG_COMPONENTS),
    ],
    localVarMap,
    nodeGenerator[node.type](node)
  )
}
