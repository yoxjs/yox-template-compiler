import {
  TAG_TEMPLATE,
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
  VNODE_TYPE_TEXT,
  VNODE_TYPE_COMMENT,
  VNODE_TYPE_ELEMENT,
  VNODE_TYPE_COMPONENT,
  VNODE_TYPE_FRAGMENT,
  VNODE_TYPE_PORTAL,
  VNODE_TYPE_SLOT,
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
import Style from './node/Style'
import Each from './node/Each'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Else from './node/Else'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Expression from './node/Expression'
import Text from './node/Text'

import {
  specialTag2VNodeType,
  parseStyleString,
} from './helper'

import {
  isNumberNativeAttribute,
  isBooleanNativeAttribute,
} from './platform/web'

// 是否正在收集虚拟节点
const vnodeStack: boolean[] = [ constant.TRUE ],

// 是否正在处理组件节点
componentStack: boolean[] = [ ],

// 是否正在处理 attribute
attributeStack: boolean[] = [ ],

// 是否正在处理特殊 each，包括 遍历 range 和 遍历数组字面量和对象字面量
eachStack: boolean[] = [ ],

// 是否正在收集动态 child
dynamicChildrenStack: boolean[] = [ constant.TRUE ],

// 收集属性值
attributeValueStack: generator.StringBuffer[] = [ ],

magicVariables: string[] = [ MAGIC_VAR_KEYPATH, MAGIC_VAR_LENGTH, MAGIC_VAR_EVENT, MAGIC_VAR_DATA ],

nodeGenerator: Record<number, (node: any) => generator.Base> = { },

FIELD_NATIVE_ATTRIBUTES = 'nativeAttrs',

FIELD_NATIVE_STYLES = 'nativeStyles',

FIELD_PROPERTIES = 'props',

FIELD_DIRECTIVES = 'directives',

FIELD_EVENTS = 'events',

FIELD_MODEL = 'model',

FIELD_LAZY = 'lazy',

FIELD_TRANSITION = 'transition',

FIELD_CHILDREN = 'children',

FIELD_SLOTS = 'slots'


// 下面这些值需要根据外部配置才能确定
let isUglify = constant.UNDEFINED,

currentTextVNode: TextVNode | void = constant.UNDEFINED,

RENDER_COMPOSE_VNODE = constant.EMPTY_STRING,

RENDER_STYLE_STRING = constant.EMPTY_STRING,

RENDER_STYLE_EXPR = constant.EMPTY_STRING,

RENDER_TRANSITION = constant.EMPTY_STRING,

RENDER_MODEL = constant.EMPTY_STRING,

RENDER_EVENT_METHOD = constant.EMPTY_STRING,

RENDER_EVENT_NAME = constant.EMPTY_STRING,

RENDER_DIRECTIVE = constant.EMPTY_STRING,

RENDER_SPREAD = constant.EMPTY_STRING,

RENDER_SLOTS = constant.EMPTY_STRING,

RENDER_SLOT_CHILDREN = constant.EMPTY_STRING,

RENDER_PARTIAL = constant.EMPTY_STRING,

RENDER_EACH = constant.EMPTY_STRING,

RENDER_RANGE = constant.EMPTY_STRING,

APPEND_VNODE_PROPERTY = constant.EMPTY_STRING,

FORMAT_NATIVE_ATTRIBUTE_NUMBER_VALUE = constant.EMPTY_STRING,

FORMAT_NATIVE_ATTRIBUTE_BOOLEAN_VALUE = constant.EMPTY_STRING,

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

OPERATOR_TEXT_VNODE = constant.EMPTY_STRING,

OPERATOR_COMMENT_VNODE = constant.EMPTY_STRING,

OPERATOR_ELEMENT_VNODE = constant.EMPTY_STRING,

OPERATOR_COMPONENT_VNODE = constant.EMPTY_STRING,

OPERATOR_FRAGMENT_VNODE = constant.EMPTY_STRING,

OPERATOR_PORTAL_VNODE = constant.EMPTY_STRING,

OPERATOR_SLOT_VNODE = constant.EMPTY_STRING,

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
    RENDER_COMPOSE_VNODE = '_a'
    RENDER_STYLE_STRING = '_b'
    RENDER_STYLE_EXPR = '_c'
    RENDER_TRANSITION = '_d'
    RENDER_MODEL = '_e'
    RENDER_EVENT_METHOD = '_f'
    RENDER_EVENT_NAME = '_g'
    RENDER_DIRECTIVE = '_h'
    RENDER_SPREAD = '_i'
    RENDER_SLOTS = '_j'
    RENDER_SLOT_CHILDREN = '_k'
    RENDER_PARTIAL = '_l'
    RENDER_EACH = '_m'
    RENDER_RANGE = '_n'
    APPEND_VNODE_PROPERTY = '_o'
    FORMAT_NATIVE_ATTRIBUTE_NUMBER_VALUE = '_p'
    FORMAT_NATIVE_ATTRIBUTE_BOOLEAN_VALUE = '_q'
    LOOKUP_KEYPATH = '_r'
    LOOKUP_PROP = '_s'
    GET_THIS = '_t'
    GET_THIS_BY_INDEX = '_u'
    GET_PROP = '_v'
    GET_PROP_BY_INDEX = '_w'
    READ_KEYPATH = '_x'
    EXECUTE_FUNCTION = '_y'
    SET_HOLDER = '_z'
    TO_STRING = '_A'
    OPERATOR_TEXT_VNODE = '_B'
    OPERATOR_COMMENT_VNODE = '_C'
    OPERATOR_ELEMENT_VNODE = '_D'
    OPERATOR_COMPONENT_VNODE = '_E'
    OPERATOR_FRAGMENT_VNODE = '_F'
    OPERATOR_PORTAL_VNODE = '_G'
    OPERATOR_SLOT_VNODE = '_H'
    ARG_INSTANCE = '_I'
    ARG_FILTERS = '_J'
    ARG_GLOBAL_FILTERS = '_K'
    ARG_LOCAL_PARTIALS = '_L'
    ARG_PARTIALS = '_M'
    ARG_GLOBAL_PARTIALS = '_N'
    ARG_DIRECTIVES = '_O'
    ARG_GLOBAL_DIRECTIVES = '_P'
    ARG_TRANSITIONS = '_Q'
    ARG_GLOBAL_TRANSITIONS = '_R'
    ARG_STACK = '_S'
    ARG_VNODE = '_T'
    ARG_CHILDREN = '_U'
    ARG_COMPONENTS = '_V'
    ARG_SCOPE = '_W'
    ARG_KEYPATH = '_X'
    ARG_LENGTH = '_Y'
    ARG_EVENT = '_Z'
    ARG_DATA = '_1'
  }
  else {
    RENDER_COMPOSE_VNODE = 'renderComposeVNode'
    RENDER_STYLE_STRING = 'renderStyleStyle'
    RENDER_STYLE_EXPR = 'renderStyleExpr'
    RENDER_TRANSITION = 'renderTransition'
    RENDER_MODEL = 'renderModel'
    RENDER_EVENT_METHOD = 'renderEventMethod'
    RENDER_EVENT_NAME = 'renderEventName'
    RENDER_DIRECTIVE = 'renderDirective'
    RENDER_SPREAD = 'renderSpread'
    RENDER_SLOTS = 'renderSlots'
    RENDER_SLOT_CHILDREN = 'renderSlotChildren'
    RENDER_PARTIAL = 'renderPartial'
    RENDER_EACH = 'renderEach'
    RENDER_RANGE = 'renderRange'
    APPEND_VNODE_PROPERTY = 'appendVNodeProperty'
    FORMAT_NATIVE_ATTRIBUTE_NUMBER_VALUE = 'formatNativeAttributeNumberValue'
    FORMAT_NATIVE_ATTRIBUTE_BOOLEAN_VALUE = 'formatNativeAttributeBooleanValue'
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
    OPERATOR_TEXT_VNODE = 'textVNodeOperator'
    OPERATOR_COMMENT_VNODE = 'commentVNodeOperator'
    OPERATOR_ELEMENT_VNODE = 'elementVNodeOperator'
    OPERATOR_COMPONENT_VNODE = 'componentVNodeOperator'
    OPERATOR_FRAGMENT_VNODE = 'fragmentVNodeOperator'
    OPERATOR_PORTAL_VNODE = 'portalVNodeOperator'
    OPERATOR_SLOT_VNODE = 'slotVNodeOperator'
    ARG_INSTANCE = 'instance'
    ARG_FILTERS = 'filters'
    ARG_GLOBAL_FILTERS = 'globalFilters'
    ARG_LOCAL_PARTIALS = 'localPartials'
    ARG_PARTIALS = 'partials'
    ARG_GLOBAL_PARTIALS = 'globalPartials'
    ARG_DIRECTIVES = 'directives'
    ARG_GLOBAL_DIRECTIVES = 'globalDirectives'
    ARG_TRANSITIONS = 'transition'
    ARG_GLOBAL_TRANSITIONS = 'globalTransitions'
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

class CommentVNode implements generator.Base {

  private text: generator.Base

  constructor(text: generator.Base) {
    this.text = text
  }

  toString(tabSize?: number) {
    return generator.toMap({
      type: generator.toPrimitive(VNODE_TYPE_COMMENT),
      isPure: generator.toPrimitive(constant.TRUE),
      operator: OPERATOR_COMMENT_VNODE,
      text: this.text,
    }).toString(tabSize)
  }

}

class TextVNode implements generator.Base {

  private buffer: generator.StringBuffer

  constructor(text: generator.Base) {
    this.buffer = generator.toStringBuffer()
    this.append(text)
  }

  append(text: generator.Base) {
    this.buffer.append(text)
  }

  toString(tabSize?: number) {
    return generator.toMap({
      type: generator.toPrimitive(VNODE_TYPE_TEXT),
      isPure: generator.toPrimitive(constant.TRUE),
      operator: OPERATOR_TEXT_VNODE,
      text: this.buffer,
    }).toString(tabSize)
  }

}

function replaceMagicVariable(name: string) {
  if (array.has(magicVariables, name)) {
    switch (name) {
      case MAGIC_VAR_KEYPATH:
        return ARG_KEYPATH

      case MAGIC_VAR_LENGTH:
        return ARG_LENGTH

      case MAGIC_VAR_EVENT:
        return ARG_EVENT

      case MAGIC_VAR_DATA:
        return ARG_DATA

      default:
        return name
    }
  }
}

function transformExpressionIdentifier(node: ExpressionIdentifier) {

  const { name, root, lookup, offset, literals } = node

  if (literals) {
    const variable = replaceMagicVariable(literals[0])
    if (isDef(variable)) {
      const result = object.copy(literals)
      result[0] = variable
      return array.join(result, constant.RAW_DOT)
    }
  }
  else {
    const variable = replaceMagicVariable(name)
    if (isDef(variable)) {
      return variable
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
      return ARG_SCOPE
    }

    return generator.toMember(
      ARG_SCOPE,
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
    getIndex = generator.addVar(
      generator.toAnonymousFunction(
        constant.UNDEFINED,
        constant.UNDEFINED,
        generator.toPrimitive(0)
      ),
      constant.TRUE
    )
  }
  else if (offset) {
    getIndex = generator.addVar(
      generator.toAnonymousFunction(
        [
          ARG_STACK
        ],
        constant.UNDEFINED,
        generator.toBinary(
          generator.toMember(
            ARG_STACK,
            [
              generator.toPrimitive(constant.RAW_LENGTH)
            ]
          ),
          '-',
          generator.toPrimitive(1 + offset)
        )
      ),
      constant.TRUE
    )
  }
  else {
    getIndex = generator.addVar(
      generator.toAnonymousFunction(
        [
          ARG_STACK
        ],
        constant.UNDEFINED,
        generator.toBinary(
          generator.toMember(
            ARG_STACK,
            [
              generator.toPrimitive(constant.RAW_LENGTH)
            ]
          ),
          '-',
          generator.toPrimitive(1)
        )
      ),
      constant.TRUE
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
        ARG_GLOBAL_FILTERS,
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
        ? ARG_STACK
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
            ARG_SCOPE,
            nodes
          ),
          stack
            ? ARG_STACK
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
            ARG_SCOPE,
            nodes
          ),
          stack
            ? ARG_STACK
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
            ? ARG_STACK
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
          ARG_SCOPE,
          stack
            ? ARG_STACK
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
            ? ARG_STACK
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
            ARG_INSTANCE,
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

function createAttributeValue(nodes: Node[]) {

  const attributeValue = generator.toStringBuffer()

  array.push(
    attributeValueStack,
    attributeValue
  )

  array.each(
    nodes,
    function (node) {
      nodeGenerator[node.type](node)
    }
  )

  array.pop(
    attributeValueStack
  )
  return attributeValue

}

function generateAttributeValue(attr: Attribute) {
  if (isDef(attr.value)) {
    return generator.toPrimitive(attr.value)
  }
  // 只有一个表达式时，保持原始类型
  if (attr.expr) {
    return generateExpression(attr.expr)
  }
  // 多个值拼接时，要求是字符串
  if (attr.children) {
    // 常见的应用场景是序列化 HTML 元素属性值，处理值时要求字符串，在处理属性名这个级别，不要求字符串
    // compiler 会把原始字符串编译成 value
    // compiler 会把单个插值编译成 expr
    // 因此走到这里，一定是多个插值或是单个特殊插值（比如 If)
    return createAttributeValue(attr.children)
  }
  return generator.toPrimitive(constant.UNDEFINED)
}

function mapNodes(nodes: Node[]) {

  currentTextVNode = constant.UNDEFINED

  const result: generator.Base[] = [ ]

  array.each(
    nodes,
    function (node) {
      const item = nodeGenerator[node.type](node)
      if (item instanceof generator.Primitive
        && item.value === constant.UNDEFINED
      ) {
        return
      }
      array.push(
        result,
        item
      )
    }
  )

  currentTextVNode = constant.UNDEFINED

  return result

}

function generateNodesToTuple(nodes: Node[]) {
  return generator.toTuple(
    constant.EMPTY_STRING,
    constant.EMPTY_STRING,
    ';',
    constant.TRUE,
    0,
    mapNodes(nodes)
  )
}

function generateNodesToList(nodes: Node[]) {
  return generator.toList(
    mapNodes(nodes)
  )
}

function generateStatementIfNeeded(nodes: generator.Base[]) {
  return nodes.length === 1
    ? nodes[0]
    : generator.toStatement(nodes, constant.TRUE)
}

function appendDynamicChildVNode(vnode: generator.Base) {

  currentTextVNode = vnode instanceof TextVNode
    ? vnode
    : constant.UNDEFINED

  return generator.toPush(
    ARG_CHILDREN,
    vnode
  )

}

function appendComponentVNode(vnode: generator.Base) {
  return generator.toPush(
    ARG_COMPONENTS,
    vnode
  )
}

function generateSelfAndGlobalReader(self: string, global: string, name: string) {
  return generator.toBinary(
    generator.toBinary(
      self,
      '&&',
      generator.toMember(
        self,
        [
          generator.toPrimitive(name)
        ]
      ),
    ),
    '||',
    generator.toMember(
      global,
      [
        generator.toPrimitive(name)
      ]
    )
  )
}

function generateVNode(vnode: generator.Base) {
  return array.last(dynamicChildrenStack)
    ? appendDynamicChildVNode(vnode)
    : vnode
}

function generateCommentVNode() {
  return generateVNode(
    new CommentVNode(
      generator.toPrimitive(constant.EMPTY_STRING)
    )
  )
}

function generateTextVNode(text: generator.Base) {
  if (currentTextVNode) {
    currentTextVNode.append(text)
    return generator.toPrimitive(constant.UNDEFINED)
  }
  return generateVNode(
    new TextVNode(text)
  )
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
            element.tag === TAG_TEMPLATE
              ? element.children
              : [ element ]
          )
          return
        }
      }

      // 匿名 slot，名称统一为 children
      // 这个步骤不能放在 compiler，因为除了 element，还会有其他节点，比如文本节点
      addSlot(SLOT_NAME_DEFAULT, [ child ])

    }
  )

  object.each(
    slots,
    function (children: Node[], name: string) {
      result.set(
        name,
        generator.toAnonymousFunction(
          [
            ARG_CHILDREN,
            ARG_COMPONENTS
          ],
          generateNodesToTuple(children)
        )
      )
    }
  )

  if (result.isNotEmpty()) {
    return result
  }

}

function parseAttrs(attrs: Node[], isComponent: boolean | void) {

  let nativeAttributeList: Attribute[] = [ ],

  propertyList: Attribute[] = [ ],

  style: Style | void = constant.UNDEFINED,

  lazyList: Directive[] = [ ],

  transition: Directive | void = constant.UNDEFINED,

  model: Directive | void = constant.UNDEFINED,

  // 最后收集事件指令、自定义指令、动态属性

  eventList: Directive[ ] = [ ],

  customDirectiveList: Directive[] = [ ],

  otherList: Node[] = [ ]

  for (let i = 0, len = attrs.length; i < len; i++) {
    const attr = attrs[i]

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
    else if (attr.type === nodeType.STYLE) {
      style = attr as Style
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

  return {
    nativeAttributeList,
    propertyList,
    style,
    lazyList,
    transition,
    model,
    eventList,
    customDirectiveList,
    otherList,
  }

}

function sortAttrs(attrs: Node[], isComponent: boolean | void) {

  const {
    nativeAttributeList,
    propertyList,
    style,
    lazyList,
    transition,
    model,
    eventList,
    customDirectiveList,
    otherList,
  } = parseAttrs(attrs, isComponent)

  const result: Node[] = []

  array.push(result, nativeAttributeList)
  array.push(result, propertyList)
  if (style) {
    array.push(result, style)
  }
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

function generateNativeAttributeValue(node: Attribute) {

  const { name } = node

  let value = generateAttributeValue(node)

  if (!(value instanceof generator.Primitive)) {
    if (isNumberNativeAttribute(name)) {
      value = generator.toCall(
        FORMAT_NATIVE_ATTRIBUTE_NUMBER_VALUE,
        [
          generator.toPrimitive(name),
          value
        ]
      )
    }
    else if (isBooleanNativeAttribute(name)) {
      value = generator.toCall(
        FORMAT_NATIVE_ATTRIBUTE_BOOLEAN_VALUE,
        [
          generator.toPrimitive(name),
          value
        ]
      )
    }
  }

  return value

}

function parseChildren(children: Node[], forceDynamic?: boolean) {

  let dynamicChildren: generator.Base | void = constant.UNDEFINED,

  staticChildren: generator.Base | void = constant.UNDEFINED,

  isDynamic = forceDynamic || constant.FALSE

  if (!isDynamic) {
    array.each(
      children,
      function (node) {
        if (!node.isStatic) {
          isDynamic = constant.TRUE
          return constant.FALSE
        }
      }
    )
  }

  array.push(
    dynamicChildrenStack,
    isDynamic
  )

  if (isDynamic) {
    dynamicChildren = generator.toAnonymousFunction(
      [
        ARG_CHILDREN
      ],
      generateNodesToTuple(
        children
      ),
      ARG_CHILDREN
    )
  }
  else {
    staticChildren = generateNodesToList(
      children
    )
  }

  array.pop(
    dynamicChildrenStack
  )

  return {
    dynamicChildren,
    staticChildren,
  }

}

nodeGenerator[nodeType.ELEMENT] = function (node: Element) {

  let { tag, dynamicTag, isComponent, to, ref, key, html, text, attrs, children } = node,

  vnodeType = isComponent
    ? VNODE_TYPE_COMPONENT
    : (specialTag2VNodeType[tag] || VNODE_TYPE_ELEMENT),

  vnode = generator.toMap({
    context: ARG_INSTANCE,
    type: generator.toPrimitive(vnodeType),
    tag: dynamicTag
      ? generateExpression(dynamicTag)
      : generator.toPrimitive(tag)
  }),

  isFragment = vnodeType === VNODE_TYPE_FRAGMENT,
  isPortal = vnodeType === VNODE_TYPE_PORTAL,
  isSlot = vnodeType === VNODE_TYPE_SLOT,

  outputAttrs: generator.Base | void = constant.UNDEFINED,
  outputChildren: generator.Base | void = constant.UNDEFINED,
  outputSlots: generator.Base | void = constant.UNDEFINED

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
    if (isSlot) {
      outputChildren = generator.toStatement(
        mapNodes(children),
        constant.TRUE
      )
    }
    else if (isComponent) {
      outputSlots = generateComponentSlots(children)
    }
    else {
      const { dynamicChildren, staticChildren } = parseChildren(children)
      if (dynamicChildren) {
        outputChildren = dynamicChildren
      }
      else if (staticChildren) {
        vnode.set(
          FIELD_CHILDREN,
          staticChildren
        )
      }
    }
  }

  // 开始序列化 attrs，原则也是先序列化非动态部分，再序列化动态部分，即指令留在最后序列化

  vnodeStack[vnodeStack.length - 1] = constant.FALSE
  attributeStack[attributeStack.length - 1] = constant.TRUE

  // 在 vnodeStack 为 false 时取值
  if (to) {
    vnode.set(
      'to',
      generateAttributeValue(to)
    )
  }
  if (ref) {
    vnode.set(
      'ref',
      generateAttributeValue(ref)
    )
  }
  if (key) {
    vnode.set(
      'key',
      generateAttributeValue(key)
    )
  }
  if (html) {
    vnode.set(
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
    vnode.set(
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
      propertyList,
      style,
      lazyList,
      transition,
      model,
      eventList,
      customDirectiveList,
      otherList,
    } = parseAttrs(attrs, isComponent),

    hasDynamicAttrs = otherList.length > 0

    if (nativeAttributeList.length) {

      let nativeAttributes = generator.toMap(), isDynamic = hasDynamicAttrs

      array.each(
        nativeAttributeList,
        function (node) {

          if (!node.isStatic) {
            isDynamic = constant.TRUE
          }

          nativeAttributes.set(
            node.name,
            generateNativeAttributeValue(node)
          )

        }
      )

      vnode.set(
        FIELD_NATIVE_ATTRIBUTES,
        isDynamic
          ? nativeAttributes
          : generator.addVar(
              nativeAttributes,
              constant.TRUE
            )
      )

    }

    if (propertyList.length) {

      const properties = generator.toMap()

      array.each(
        propertyList,
        function (node) {
          properties.set(
            node.name,
            generateAttributeValue(node)
          )
        }
      )

      vnode.set(
        FIELD_PROPERTIES,
        properties
      )

    }

    if (style) {
      vnode.set(
        FIELD_NATIVE_STYLES,
        getStyleValue(style)
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

      vnode.set(
        FIELD_LAZY,
        lazy
      )

    }

    if (transition) {
      vnode.set(
        FIELD_TRANSITION,
        getTransitionValue(transition)
      )
    }

    if (model) {
      vnode.set(
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

      vnode.set(
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

      vnode.set(
        FIELD_DIRECTIVES,
        directives
      )

    }

    if (otherList.length) {
      outputAttrs = generator.toAnonymousFunction(
        [
          ARG_VNODE
        ],
        generateNodesToTuple(otherList),
        ARG_VNODE
      )
    }
  }

  array.pop(vnodeStack)
  array.pop(attributeStack)
  array.pop(componentStack)

  if (vnodeType === VNODE_TYPE_ELEMENT) {
    vnode.set(
      'operator',
      OPERATOR_ELEMENT_VNODE
    )
  }
  else if (isFragment) {
    vnode.set(
      'isFragment',
      generator.toPrimitive(constant.TRUE)
    )
    vnode.set(
      'operator',
      OPERATOR_FRAGMENT_VNODE
    )
  }
  else if (isPortal) {
    vnode.set(
      'operator',
      OPERATOR_PORTAL_VNODE
    )
  }
  else if (isComponent) {
    vnode.set(
      'isComponent',
      generator.toPrimitive(constant.TRUE)
    )
    vnode.set(
      'operator',
      OPERATOR_COMPONENT_VNODE
    )
  }
  else if (isSlot) {

    vnode.set(
      'isSlot',
      generator.toPrimitive(constant.TRUE)
    )
    vnode.set(
      'operator',
      OPERATOR_SLOT_VNODE
    )

    let nameAttr = node.name,

    argName: generator.Base = generator.toPrimitive(
      SLOT_DATA_PREFIX + SLOT_NAME_DEFAULT
    )

    if (nameAttr) {
      // 如果 name 是字面量，直接拼出结果
      argName = isDef(nameAttr.value)
        ? generator.toPrimitive(
            SLOT_DATA_PREFIX + nameAttr.value
          )
        : generator.toBinary(
            generator.toPrimitive(SLOT_DATA_PREFIX),
            '+',
            generator.toPrecedence(
              generateAttributeValue(nameAttr)
            )
          )
    }

    const renderSlot = generator.toCall(
      RENDER_SLOT_CHILDREN,
      [
        argName,
        ARG_CHILDREN
      ]
    )

    outputChildren = generator.toAnonymousFunction(
      [
        ARG_CHILDREN
      ],
      outputChildren
        ? generator.toBinary(
            renderSlot,
            '||',
            outputChildren
          )
        : renderSlot,
      ARG_CHILDREN
    )

  }
  if (node.isOption) {
    vnode.set(
      'isOption',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isStyle) {
    vnode.set(
      'isStyle',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isSvg) {
    vnode.set(
      'isSvg',
      generator.toPrimitive(constant.TRUE)
    )
  }
  if (node.isStatic) {
    vnode.set(
      'isStatic',
      generator.toPrimitive(constant.TRUE)
    )
    vnode.set(
      'isPure',
      generator.toPrimitive(constant.TRUE)
    )
  }

  if (outputChildren) {
    vnode.set(
      FIELD_CHILDREN,
      generator.toCall(
        outputChildren,
        [
          generator.toList()
        ]
      )
    )
  }
  if (outputSlots) {
    vnode.set(
      FIELD_SLOTS,
      generator.toCall(
        RENDER_SLOTS,
        [
          outputSlots
        ]
      )
    )
  }

  const list: generator.Base[] = [],

  result: generator.Base = outputAttrs
    ? generator.toCall(
        outputAttrs,
        [
          vnode,
        ]
      )
    : vnode

  if (isFragment || isPortal || isSlot) {
    array.push(
      list,
      generator.toCall(
        RENDER_COMPOSE_VNODE,
        [
          result,
          ARG_CHILDREN,
        ]
      )
    )
    return generateStatementIfNeeded(list)
  }

  array.push(
    list,
    result
  )

  return generateVNode(
    isComponent
    ? appendComponentVNode(
        generateStatementIfNeeded(list)
      )
    : generateStatementIfNeeded(list)
  )

}

nodeGenerator[nodeType.ATTRIBUTE] = function (node: Attribute) {
  return generator.toCall(
    APPEND_VNODE_PROPERTY,
    [
      ARG_VNODE,
      generator.toPrimitive(
        array.last(componentStack)
          ? FIELD_PROPERTIES
          : FIELD_NATIVE_ATTRIBUTES
      ),
      generator.toPrimitive(node.name),
      generateNativeAttributeValue(node),
    ]
  )

}

nodeGenerator[nodeType.STYLE] = function (node: Style) {

  return generator.toAssign(
    generator.toMember(
      ARG_VNODE,
      [
        generator.toPrimitive(FIELD_NATIVE_STYLES)
      ]
    ),
    getStyleValue(node)
  )

}

function getStyleValue(node: Style) {

  if (isDef(node.value)) {
    const styles = generator.toMap()
    parseStyleString(
      node.value as string,
      function (key, value) {
        styles.set(
          key,
          generator.toPrimitive(value)
        )
      }
    )
    return styles
  }

  if (node.expr) {
    if (node.expr.type === exprNodeType.OBJECT) {
      return generateExpression(node.expr)
    }
    return generator.toCall(
      RENDER_STYLE_EXPR,
      [
        generateExpression(node.expr)
      ]
    )
  }

  // 多值拼接，compiler 保证了 children 必然有值
  return generator.toCall(
    RENDER_STYLE_STRING,
    [
      createAttributeValue(node.children as Node[])
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
              ARG_STACK,
              ARG_EVENT,
              ARG_DATA,
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
                ARG_STACK,
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
        generator.toMember(
          ARG_INSTANCE,
          [
            generator.toPrimitive((callNode.name as ExpressionIdentifier).name)
          ]
        )
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
                ARG_STACK
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
        APPEND_VNODE_PROPERTY,
        [
          ARG_VNODE,
          generator.toPrimitive(FIELD_LAZY),
          generator.toPrimitive(node.name),
          getLazyValue(node),
        ]
      )

    // <div transition="name">
    case DIRECTIVE_TRANSITION:
      return generator.toAssign(
        generator.toMember(
          ARG_VNODE,
          [
            generator.toPrimitive(FIELD_TRANSITION)
          ]
        ),
        getTransitionValue(node)
      )

    // <input model="id">
    case DIRECTIVE_MODEL:
      return generator.toAssign(
        generator.toMember(
          ARG_VNODE,
          [
            generator.toPrimitive(FIELD_MODEL)
          ]
        ),
        getModelValue(node)
      )

    // <div on-click="name">
    case DIRECTIVE_EVENT:
      const info = getEventInfo(node)
      return generator.toCall(
        APPEND_VNODE_PROPERTY,
        [
          ARG_VNODE,
          generator.toPrimitive(FIELD_EVENTS),
          generator.toPrimitive(getDirectiveKey(node)),
          generator.toCall(
            info.name,
            info.args
          ),
        ]
      )

    default:
      return generator.toCall(
        APPEND_VNODE_PROPERTY,
        [
          ARG_VNODE,
          generator.toPrimitive(FIELD_DIRECTIVES),
          generator.toPrimitive(getDirectiveKey(node)),
          generator.toCall(
            RENDER_DIRECTIVE,
            getDirectiveArgs(node)
          ),
        ]
      )
  }

}

nodeGenerator[nodeType.SPREAD] = function (node: Spread) {
  return generator.toCall(
    RENDER_SPREAD,
    [
      ARG_VNODE,
      generator.toPrimitive(FIELD_PROPERTIES),
      generateExpression(node.expr)
    ]
  )
}

nodeGenerator[nodeType.TEXT] = function (node: Text) {

  const text = generator.toPrimitive(node.text)

  if (array.last(vnodeStack)) {
    return generateTextVNode(text)
  }

  const attributeValue = array.last(attributeValueStack)
  if (attributeValue) {
    attributeValue.append(text)
    return generator.toPrimitive(constant.UNDEFINED)
  }

  return text

}

nodeGenerator[nodeType.EXPRESSION] = function (node: Expression) {

  const value = generateExpression(node.expr)

  if (array.last(vnodeStack)) {
    return generateTextVNode(
      generator.toCall(
        TO_STRING,
        [
          value
        ]
      )
    )
  }

  const attributeValue = array.last(attributeValueStack)
  if (attributeValue) {
    attributeValue.append(
      generator.toCall(
        TO_STRING,
        [
          value
        ]
      )
    )
    return generator.toPrimitive(constant.UNDEFINED)
  }

  return value

}

function getBranchDefaultValue() {
  return array.last(vnodeStack)
    ? generateCommentVNode()
    : array.last(attributeValueStack)
      ? generator.toPrimitive(constant.EMPTY_STRING)
      : generator.toPrimitive(constant.UNDEFINED)
}

function getBranchValue(children: Node[] | void) {
  if (children) {
    if (array.last(attributeStack)) {
      children = sortAttrs(children, array.last(componentStack))
    }
    if (array.last(attributeValueStack)) {
      return createAttributeValue(children)
    }
    return generateStatementIfNeeded(
      mapNodes(children)
    )
  }
}

nodeGenerator[nodeType.IF] = function (node: If) {

  const { next } = node,

  attributeValue = array.last(attributeValueStack),

  defaultValue = getBranchDefaultValue(),

  result = generator.toTernary(
    generateExpression(node.expr),
    getBranchValue(node.children) || defaultValue,
    next
      ? nodeGenerator[next.type](next)
      : defaultValue
  )

  if (attributeValue) {
    attributeValue.append(result)
    return generator.toPrimitive(constant.UNDEFINED)
  }

  return result

}

nodeGenerator[nodeType.ELSE_IF] = function (node: If | ElseIf) {

  const { next } = node,

  defaultValue = getBranchDefaultValue()

  return generator.toTernary(
    generateExpression(node.expr),
    getBranchValue(node.children) || defaultValue,
    next
      ? nodeGenerator[next.type](next)
      : defaultValue
  )

}

nodeGenerator[nodeType.ELSE] = function (node: Else) {

  return getBranchValue(node.children) || getBranchDefaultValue()

}

nodeGenerator[nodeType.EACH] = function (node: Each) {

  const { index, from, to, equal, next } = node,

  isSpecial = to || from.type === exprNodeType.ARRAY || from.type === exprNodeType.OBJECT

  const args = [
    ARG_SCOPE,
    ARG_KEYPATH,
    ARG_LENGTH,
  ]

  if (index) {
    array.push(
      args,
      index
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
      ARG_LOCAL_PARTIALS,
      [
        generator.toPrimitive(node.name)
      ]
    ),
    generator.toAnonymousFunction(
      [
        ARG_SCOPE,
        ARG_KEYPATH,
        ARG_CHILDREN,
        ARG_COMPONENTS,
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
      ARG_SCOPE,
      ARG_KEYPATH,
      ARG_CHILDREN,
      ARG_COMPONENTS,
      generator.toMember(
        ARG_LOCAL_PARTIALS,
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

  return generator.generate(
    [
      RENDER_COMPOSE_VNODE,
      RENDER_STYLE_STRING,
      RENDER_STYLE_EXPR,
      RENDER_TRANSITION,
      RENDER_MODEL,
      RENDER_EVENT_METHOD,
      RENDER_EVENT_NAME,
      RENDER_DIRECTIVE,
      RENDER_SPREAD,
      RENDER_SLOTS,
      RENDER_SLOT_CHILDREN,
      RENDER_PARTIAL,
      RENDER_EACH,
      RENDER_RANGE,
      APPEND_VNODE_PROPERTY,
      FORMAT_NATIVE_ATTRIBUTE_NUMBER_VALUE,
      FORMAT_NATIVE_ATTRIBUTE_BOOLEAN_VALUE,
      LOOKUP_KEYPATH,
      LOOKUP_PROP,
      GET_THIS,
      GET_THIS_BY_INDEX,
      GET_PROP,
      GET_PROP_BY_INDEX,
      READ_KEYPATH,
      EXECUTE_FUNCTION,
      SET_HOLDER,
      TO_STRING,
      OPERATOR_TEXT_VNODE,
      OPERATOR_COMMENT_VNODE,
      OPERATOR_ELEMENT_VNODE,
      OPERATOR_COMPONENT_VNODE,
      OPERATOR_FRAGMENT_VNODE,
      OPERATOR_PORTAL_VNODE,
      OPERATOR_SLOT_VNODE,
      ARG_INSTANCE,
      ARG_FILTERS,
      ARG_GLOBAL_FILTERS,
      ARG_LOCAL_PARTIALS,
      ARG_PARTIALS,
      ARG_GLOBAL_PARTIALS,
      ARG_DIRECTIVES,
      ARG_GLOBAL_DIRECTIVES,
      ARG_TRANSITIONS,
      ARG_GLOBAL_TRANSITIONS,
      ARG_SCOPE,
      ARG_KEYPATH,
      ARG_CHILDREN,
      ARG_COMPONENTS,
    ],
    nodeGenerator[node.type](node)
  )
}
