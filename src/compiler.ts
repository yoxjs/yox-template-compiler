import {
  SYNTAX_COMMENT,
  SYNTAX_EACH,
  SYNTAX_ELSE,
  SYNTAX_ELSE_IF,
  SYNTAX_IF,
  SYNTAX_IMPORT,
  SYNTAX_PARTIAL,
  SYNTAX_SPREAD,
  HINT_BOOLEAN,
  HINT_NUMBER,
  DIRECTIVE_ON,
  DIRECTIVE_EVENT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_CUSTOM,
  SLOT_NAME_DEFAULT,
  MODIFER_NATIVE,
} from 'yox-config/src/config'

import {
  isSelfClosing,
  createAttribute,
  getAttributeDefaultValue,
  createElement,
  compatElement,
  setElementText,
} from './platform/web'

import * as constant from 'yox-type/src/constant'

import toNumber from 'yox-common/src/function/toNumber'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as logger from 'yox-common/src/util/logger'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as exprCompiler from 'yox-expression-compiler/src/compiler'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'
import ExpressionLiteral from 'yox-expression-compiler/src/node/Literal'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'

import * as helper from './helper'
import * as creator from './creator'
import * as nodeType from './nodeType'

import If from './node/If'
import ElseIf from './node/ElseIf'
import Else from './node/Else'
import Node from './node/Node'
import Branch from './node/Branch'
import Text from './node/Text'
import Each from './node/Each'
import Partial from './node/Partial'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
import Expression from './node/Expression'

// 当前不位于 block 之间
const BLOCK_MODE_NONE = 1,

// {{ x }}
BLOCK_MODE_SAFE = 2,

// {{{ x }}}
BLOCK_MODE_UNSAFE = 3,

// 缓存编译正则
patternCache = {},

// 指令分隔符，如 on-click 和 lazy-click
directiveSeparator = '-',

// 调用的方法
methodPattern = /^[_$a-z]([\w]+)?$/,

// 没有命名空间的事件
eventPattern = /^[_$a-z]([\w]+)?$/i,

// 有命名空间的事件
eventNamespacePattern = /^[_$a-z]([\w]+)?\.[_$a-z]([\w]+)?$/i,

// 换行符
// 比较神奇是，有时候你明明看不到换行符，却真的存在一个，那就是 \r
breaklinePattern = /^\s*[\n\r]\s*|\s*[\n\r]\s*$/g,

// 区间遍历
rangePattern = /\s*(=>|->)\s*/,

// 标签
tagPattern = /<(\/)?([$a-z][-a-z0-9]*)/i,

// 注释
commentPattern = /<!--[\s\S]*?-->/g,

// 开始注释
openCommentPattern = /^([\s\S]*?)<!--/,

// 结束注释
closeCommentPattern = /-->([\s\S]*?)$/,

// 属性的 name
// 支持 on-click.namespace="" 或 on-get-out="" 或 xml:xx=""
attributePattern = /^\s*([-.:\w]+)(['"])?(?:=(['"]))?/,

// 自闭合标签
selfClosingTagPattern = /^\s*(\/)?>/

/**
 * 截取前缀之后的字符串
 */
function slicePrefix(str: string, prefix: string): string {
  return string.trim(string.slice(str, prefix.length))
}

export function compile(content: string): Branch[] {

  let nodeList: Branch[] = [],

  nodeStack: Branch[] = [],

  // 持有 if/elseif/else 节点
  ifStack: Node[] = [],

  currentElement: Element | void,

  currentAttribute: Attribute | Property | Directive | void,

  length = content.length,

  // 当前处理的位置
  index = 0,

  // 下一段开始的位置
  nextIndex = 0,

  // 开始定界符的位置，表示的是 {{ 的右侧位置
  openBlockIndex = 0,

  // 结束定界符的位置，表示的是 }} 的左侧位置
  closeBlockIndex = 0,

  // 当前正在处理或即将处理的 block 类型
  blockMode = BLOCK_MODE_NONE,

  // mustache 注释可能出现嵌套插值的情况
  blockStack: boolean[] = [],

  indexList: number[] = [],

  code: string,

  startQuote: string | void,

  fatal = function (msg: string) {
    if (process.env.NODE_ENV === 'development') {
      logger.fatal(`Error compiling template\n\n${content}\n\nmessage: ${msg}`)
    }
  },

  /**
   * 常见的两种情况：
   *
   * <div>
   *    <input>1
   * </div>
   *
   * <div>
   *    <input>
   * </div>
   */
  popSelfClosingElementIfNeeded = function (popingTagName?: string) {
    const lastNode = array.last(nodeStack)
    if (lastNode && lastNode.type === nodeType.ELEMENT) {
      const element = lastNode as Element
      if (element.tag !== popingTagName
        && isSelfClosing(element.tag)
      ) {
        popStack(element.type, element.tag)
      }
    }
  },

  popStack = function (type: number, tagName?: string) {

    const node = array.pop(nodeStack)

    if (node && node.type === type) {

      const { children } = node,

      // 优化单个子节点
      child = children && children.length === 1 && children[0],

      isElement = type === nodeType.ELEMENT,

      isAttribute = type === nodeType.ATTRIBUTE,

      isProperty = type === nodeType.PROPERTY,

      isDirective = type === nodeType.DIRECTIVE

      const currentBranch = array.last(nodeStack)

      if (currentBranch) {
        if (currentBranch.isStatic && !node.isStatic) {
          currentBranch.isStatic = constant.FALSE
        }
        if (!currentBranch.isComplex) {
          if (node.isComplex || isElement) {
            currentBranch.isComplex = constant.TRUE
          }
          // <div {{#if xx}} xx{{/if}}>
          else if (currentElement
            && currentElement !== currentBranch
            && (isAttribute || isProperty || isDirective)
          ) {
            currentBranch.isComplex = constant.TRUE
          }
        }
      }

      if (process.env.NODE_ENV === 'development') {
        if (isElement) {
          const element = node as Element
          if (tagName && element.tag !== tagName) {
            fatal(`End tag is "${tagName}"，but start tag is "${element.tag}".`)
          }
        }
      }

      // 除了 helper.specialAttrs 里指定的特殊属性，attrs 里的任何节点都不能单独拎出来赋给 element
      // 因为 attrs 可能存在 if，所以每个 attr 最终都不一定会存在
      if (child) {

        switch (child.type) {

          case nodeType.TEXT:
            // 属性的值如果是纯文本，直接获取文本值
            // 减少渲染时的遍历
            if (isElement) {
              processElementSingleText(node as Element, child as Text)
            }
            else if (isAttribute) {
              processAttributeSingleText(node as Attribute, child as Text)
            }
            else if (isProperty) {
              processPropertySingleText(node as Property, child as Text)
            }
            else if (isDirective) {
              processDirectiveSingleText(node as Directive, child as Text)
            }
            break

          case nodeType.EXPRESSION:
            if (isElement) {
              processElementSingleExpression(node as Element, child as Expression)
            }
            else if (isAttribute) {
              processAttributeSingleExpression(node as Attribute, child as Expression)
            }
            else if (isProperty) {
              processPropertySingleExpression(node as Property, child as Expression)
            }
            else if (isDirective) {
              processDirectiveSingleExpression(node as Directive, child as Expression)
            }
            break

        }
      }
      // 大于 1 个子节点，即有插值或 if 写法
      else if (children) {

        if (isDirective) {
          processDirectiveMultiChildren()
        }
        // 元素层级
        else if (!currentElement) {
          removeComment(children)
          if (!children.length) {
            node.children = constant.UNDEFINED
          }
        }

      }
      // 0 个子节点
      else if (currentElement) {
        if (isAttribute) {
          processAttributeEmptyChildren(currentElement, node as Attribute)
        }
        else if (isProperty) {
          processPropertyEmptyChildren(currentElement, node as Property)
        }
        else if (isDirective) {
          processDirectiveEmptyChildren(currentElement, node as Directive)
        }
      }

      if (type === nodeType.EACH) {
        checkEach(node as Each)
      }
      else if (type === nodeType.PARTIAL) {
        checkPartial(node as Partial)
      }
      else if (isElement) {
        checkElement(node as Element)
      }
      else if (currentElement) {
        if (isAttribute) {
          if (isSpecialAttr(currentElement, node as Attribute)) {
            bindSpecialAttr(currentElement, node as Attribute)
          }
        }
        else if (isDirective) {
          checkDirective(currentElement, node as Directive)
        }
      }

      return node

    }

    // 出栈节点类型不匹配
    if (process.env.NODE_ENV === 'development') {
      fatal(`The type of poping node is not expected.`)
    }
  },

  removeComment = function (children: Node[]) {

    // 类似 <!-- xx {{name}} yy {{age}} zz --> 这样的注释里包含插值
    // 按照目前的解析逻辑，是根据定界符进行模板分拆
    // 一旦出现插值，children 长度必然大于 1

    let openIndex = constant.MINUS_ONE,

    openText = constant.EMPTY_STRING,

    closeIndex = constant.MINUS_ONE,

    closeText = constant.EMPTY_STRING

    array.each(
      children,
      function (child, index) {
        if (child.type === nodeType.TEXT) {
          // 有了结束 index，这里的任务是配对开始 index
          if (closeIndex >= 0) {
            openText = (child as Text).text
            // 处理 <!-- <!-- 这样有多个的情况
            while (openCommentPattern.test(openText)) {
              openText = RegExp.$1
              openIndex = index
            }

            if (openIndex >= 0) {
              // openIndex 肯定小于 closeIndex，因为完整的注释在解析过程中会被干掉
              // 只有包含插值的注释才会走进这里

              let startIndex = openIndex, endIndex = closeIndex

              // 现在要确定开始和结束的文本节点，是否包含正常文本
              if (openText) {
                (children[openIndex] as Text).text = openText
                startIndex++
              }
              if (closeText) {
                // 合并开始和结束文本，如 1<!-- {{x}}{{y}} -->2
                // 这里要把 1 和 2 两个文本节点合并成一个
                if (openText) {
                  (children[openIndex] as Text).text += closeText
                }
                else {
                  (children[closeIndex] as Text).text = closeText
                  endIndex--
                }
              }

              children.splice(startIndex, endIndex - startIndex + 1)

              // 重置，再继续寻找结束 index
              openIndex = closeIndex = constant.MINUS_ONE
            }
          }
          else {
            // 从后往前遍历
            // 一旦发现能匹配 --> 就可以断定这是注释的结束 index
            // 剩下的就是找开始 index
            closeText = (child as Text).text
            // 处理 --> --> 这样有多个的情况
            while (closeCommentPattern.test(closeText)) {
              closeText = RegExp.$1
              closeIndex = index
            }
          }
        }
      },
      constant.TRUE
    )
  },

  processDirectiveMultiChildren = function () {
    // 不支持 on-click="1{{xx}}2" 或是 on-click="1{{#if x}}x{{else}}y{{/if}}2"
    // 1. 很难做性能优化
    // 2. 全局搜索不到事件名，不利于代码维护
    // 3. 不利于编译成静态函数
    if (process.env.NODE_ENV === 'development') {
      fatal('For performance, "{{" and "}}" are not allowed in directive value.')
    }
  },

  processElementSingleText = function (element: Element, child: Text) {

    // processElementSingleText 和 processElementSingleExpression
    // 不把元素子节点智能转换为 textContent property
    // 因为子节点还有 <div>1{{a}}{{b}}</div> 这样的情况
    // 还是在序列化的时候统一处理比较好

    // 唯独需要在这特殊处理的是 html 实体
    // 但这只是 WEB 平台的特殊逻辑，所以丢给 platform 处理
    if (setElementText(element, child.text)) {
      element.children = constant.UNDEFINED
    }

  },

  processElementSingleExpression = function (element: Element, child: Expression) {

    if (!element.isComponent && !element.slot && !child.safe) {
      element.html = child.expr
      element.children = constant.UNDEFINED
    }

  },

  processPropertyEmptyChildren = function (element: Element, prop: Property) {

    if (prop.hint === HINT_BOOLEAN) {
      prop.value = constant.TRUE
    }
    else {
      // string 或 number 类型的属性，如果不写值，直接忽略
      replaceChild(prop)
    }

  },

  processPropertySingleText = function (prop: Property, child: Text) {

    const { text } = child

    if (prop.hint === HINT_NUMBER) {
      prop.value = toNumber(text)
    }
    else if (prop.hint === HINT_BOOLEAN) {
      prop.value = text === constant.RAW_TRUE || text === prop.name
    }
    else {
      prop.value = text
    }

    prop.children = constant.UNDEFINED

  },

  processPropertySingleExpression = function (prop: Property, child: Expression) {

    const { expr } = child

    prop.expr = expr
    prop.children = constant.UNDEFINED

    // 对于有静态路径的表达式，可转为单向绑定指令，可实现精确更新视图，如下
    // <div class="{{className}}">

    if (expr.type === exprNodeType.IDENTIFIER) {
      prop.binding = constant.TRUE
    }

  },

  processAttributeEmptyChildren = function (element: Element, attr: Attribute) {

    if (isSpecialAttr(element, attr)) {
      if (process.env.NODE_ENV === 'development') {
        fatal(`The value of "${attr.name}" is empty.`)
      }
    }
    else {
      attr.value = getAttributeDefaultValue(element, attr.name)
    }

  },

  processAttributeSingleText = function (attr: Attribute, child: Text) {

    attr.value = child.text
    attr.children = constant.UNDEFINED

  },

  processAttributeSingleExpression = function (attr: Attribute, child: Expression) {

    const { expr } = child

    attr.expr = expr
    attr.children = constant.UNDEFINED

    // 对于有静态路径的表达式，可转为单向绑定指令，可实现精确更新视图，如下
    // <div class="{{className}}">

    if (expr.type === exprNodeType.IDENTIFIER) {
      attr.binding = constant.TRUE
    }

  },

  processDirectiveEmptyChildren = function (element: Element, directive: Directive) {

    directive.value = constant.TRUE

  },

  processDirectiveSingleText = function (directive: Directive, child: Text) {

    let { text } = child,

    // model="xx" model="this.x" 值只能是标识符或 Member
    isModel = directive.ns === DIRECTIVE_MODEL,

    // lazy 的值必须是大于 0 的数字
    isLazy = directive.ns === DIRECTIVE_LAZY,

    // 校验事件名称
    // 且命名空间不能用 native
    isEvent = directive.ns === DIRECTIVE_EVENT,

    // 自定义指令运行不合法的表达式
    isCustom = directive.ns === DIRECTIVE_CUSTOM,

    // 指令的值是纯文本，可以预编译表达式，提升性能
    expr: ExpressionNode | void,

    error: any

    try {
      expr = exprCompiler.compile(text)
    }
    catch (e) {
      error = e
    }

    if (expr) {

      if (process.env.NODE_ENV === 'development') {

        const { raw } = expr

        if (isLazy) {
          if (expr.type !== exprNodeType.LITERAL
            || !is.number((expr as ExpressionLiteral).value)
            || (expr as ExpressionLiteral).value <= 0
          ) {
            fatal('The value of lazy must be a number greater than 0.')
          }
        }

        // 如果指令表达式是函数调用，则只能调用方法（难道还有别的可以调用的吗？）
        else if (expr.type === exprNodeType.CALL) {
          let methodName = (expr as ExpressionCall).name
          if (methodName.type !== exprNodeType.IDENTIFIER) {
            fatal('Invalid method name.')
          }
          // 函数调用调用方法，因此不能是 a.b() 的形式
          else if (!methodPattern.test((methodName as ExpressionIdentifier).name)) {
            fatal('Invalid method name.')
          }
        }

        // 上面检测过方法调用，接下来事件指令只需要判断是否以下两种格式：
        // on-click="name" 或 on-click="name.namespace"
        else if (isEvent) {
          if (eventPattern.test(raw) || eventNamespacePattern.test(raw)) {

            // native 有特殊用处，不能给业务层用
            if (eventNamespacePattern.test(raw)
              && raw.split(constant.RAW_DOT)[1] === MODIFER_NATIVE
            ) {
              fatal(`The event namespace "${MODIFER_NATIVE}" is not permitted.`)
            }

            // <Button on-click="click"> 这种写法没有意义
            if (currentElement
              && currentElement.isComponent
              && directive.name === raw
            ) {
              fatal(`The event name listened and fired can't be the same.`)
            }

          }
          // 事件转换名称只能是 [name] 或 [name.namespace] 格式
          else {
            fatal('The event name and namespace must be an identifier.')
          }
        }

        if (isModel && expr.type !== exprNodeType.IDENTIFIER) {
          fatal('The value of the model must be an identifier.')
        }

      }

      directive.expr = expr

      directive.value = expr.type === exprNodeType.LITERAL
        ? (expr as ExpressionLiteral).value
        : text

    }
    else {
      // 自定义指令支持错误的表达式
      // 反正是自定义的规则，爱怎么写就怎么写
      if (process.env.NODE_ENV === 'development') {
        if (!isCustom) {
          throw error
        }
      }
      directive.value = text
    }

    directive.children = constant.UNDEFINED

  },

  processDirectiveSingleExpression = function (directive: Directive, child: Expression) {

    if (process.env.NODE_ENV === 'development') {
      fatal('For performance, "{{" and "}}" are not allowed in directive value.')
    }

  },

  checkCondition = function (condition: If | ElseIf | Else) {

    let currentNode: any = condition,

    prevNode: any,

    hasChildren: boolean | void,

    hasNext: boolean | void

    while (constant.TRUE) {
      if (currentNode.children) {
        if (!hasNext) {
          if (currentNode.next) {
            delete currentNode.next
          }
        }
        hasChildren = hasNext = constant.TRUE
      }
      prevNode = currentNode.prev
      if (prevNode) {
        // prev 仅仅用在 checkCondition 函数中
        // 用完就可以删掉了
        delete currentNode.prev
        currentNode = prevNode
      }
      else {
        break
      }
    }

    // 每个条件都是空内容，则删掉整个 if
    if (!hasChildren) {
      replaceChild(currentNode)
    }

  },

  checkEach = function (each: Each) {
    // 没内容就干掉
    if (!each.children) {
      replaceChild(each)
    }
  },

  checkPartial = function (partial: Partial) {
    // 没内容就干掉
    if (!partial.children) {
      replaceChild(partial)
    }
  },

  checkElement = function (element: Element) {

    const { tag, slot } = element, isTemplate = tag === constant.RAW_TEMPLATE

    if (process.env.NODE_ENV === 'development') {
      if (isTemplate) {
        if (element.key) {
          fatal(`The "key" is not supported in <template>.`)
        }
        else if (element.ref) {
          fatal(`The "ref" is not supported in <template>.`)
        }
        else if (element.attrs) {
          fatal(`The attributes and directives are not supported in <template>.`)
        }
        else if (!slot) {
          fatal(`The "slot" is required in <template>.`)
        }
      }
    }

    // 没有子节点，则意味着这个插槽没任何意义
    if (isTemplate && slot && !element.children) {
      replaceChild(element)
    }
    // <slot /> 如果没写 name，自动加上默认名称
    else if (tag === constant.RAW_SLOT && !element.name) {
      element.name = SLOT_NAME_DEFAULT
    }
    else {
      compatElement(element)
    }

  },

  checkDirective = function (element: Element, directive: Directive) {
    if (process.env.NODE_ENV === 'development') {
      // model 不能写在 if 里，影响节点的静态结构
      if (directive.ns === DIRECTIVE_MODEL) {
        if (array.last(nodeStack) !== element) {
          fatal(`The "model" can't be used in an if block.`)
        }
      }
    }
  },

  bindSpecialAttr = function (element: Element, attr: Attribute) {

    const { name, value } = attr,

    // 这三个属性值要求是字符串
    isStringValueRequired = name === constant.RAW_NAME || name === constant.RAW_SLOT

    if (process.env.NODE_ENV === 'development') {
      // 因为要拎出来给 element，所以不能用 if
      if (array.last(nodeStack) !== element) {
        fatal(`The "${name}" can't be used in an if block.`)
      }
      // 对于所有特殊属性来说，空字符串是肯定不行的，没有任何意义
      if (value === constant.EMPTY_STRING) {
        fatal(`The value of "${name}" is empty.`)
      }
      else if (isStringValueRequired && string.falsy(value)) {
        fatal(`The value of "${name}" can only be a string literal.`)
      }
    }

    element[name] = isStringValueRequired ? value : attr
    replaceChild(attr)

  },

  isSpecialAttr = function (element: Element, attr: Attribute): boolean {
    return helper.specialAttrs[attr.name]
      || element.tag === constant.RAW_SLOT && attr.name === constant.RAW_NAME
  },

  replaceChild = function (oldNode: Node, newNode?: Node) {

    let currentBranch = array.last(nodeStack),

    isAttr: boolean | void,

    list: Node[] | void,

    index: number

    if (currentBranch) {
      isAttr = currentElement && currentElement === currentBranch
      list = isAttr
        ? (currentBranch as Element).attrs
        : currentBranch.children
    }
    else {
      list = nodeList
    }

    if (list) {
      index = array.indexOf(list, oldNode)
      if (index >= 0) {
        if (newNode) {
          list[index] = newNode
        }
        else {
          list.splice(index, 1)
          if (currentBranch && !list.length) {
            if (isAttr) {
              delete (currentBranch as Element).attrs
            }
            else {
              currentBranch.children = constant.UNDEFINED
            }
          }
        }
      }
    }

  },

  addChild = function (node: Node) {

    /**
     * <div>
     *    <input>
     *    <div></div>
     * </div>
     *
     * <div>
     *    <input>xxx
     * </div>
     */
    if (!currentElement) {
      popSelfClosingElementIfNeeded()
    }

    const type = node.type, currentBranch = array.last(nodeStack)

    // else 系列只是 if 的递进节点，不需要加入 nodeList
    if (type === nodeType.ELSE || type === nodeType.ELSE_IF) {

      const lastNode: any = array.pop(ifStack)

      if (lastNode) {

        // 方便 checkCondition 逆向遍历
        (node as any).prev = lastNode

        // lastNode 只能是 if 或 else if 节点
        if (lastNode.type === nodeType.ELSE_IF || lastNode.type === nodeType.IF) {
          lastNode.next = node
          popStack(lastNode.type)
          array.push(ifStack, node)
        }
        else if (type === nodeType.ELSE_IF) {
          if (process.env.NODE_ENV === 'development') {
            fatal('The "else" block must not be followed by an "else if" block.')
          }
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "else" block can't appear more than once in a conditional statement.`)
        }
      }
      else if (process.env.NODE_ENV === 'development') {
        fatal('The "if" block is required.')
      }

    }
    else {

      if (currentBranch) {
        // 这里不能写 currentElement && !currentAttribute，举个例子
        //
        // <div id="x" {{#if}} name="xx" alt="xx" {{/if}}
        //
        // 当 name 属性结束后，条件满足，但此时已不是元素属性层级了
        if (currentElement && currentBranch.type === nodeType.ELEMENT) {
          const attrs = currentElement.attrs || (currentElement.attrs = [])
          // node 没法转型，一堆可能的类型怎么转啊...
          array.push(attrs, node as any)
        }
        else {
          const children = currentBranch.children || (currentBranch.children = []),
          lastChild = array.last(children)
          // 连续添加文本节点，则直接合并
          if (lastChild
            && lastChild.type === nodeType.TEXT
            && node.type === nodeType.TEXT
          ) {
            (lastChild as Text).text += (node as Text).text
            return
          }
          else {
            array.push(children, node)
          }
        }
      }
      else {
        array.push(nodeList, node)
      }

      if (type === nodeType.IF) {
        // 只要是 if 节点，并且和 element 同级，就加上 stub
        // 方便 virtual dom 进行对比
        // 这个跟 virtual dom 的实现原理密切相关，不加 stub 会有问题
        if (!currentElement) {
          (node as If).stub = constant.TRUE
        }
        array.push(ifStack, node)
      }

    }



    if (node.isLeaf) {
      // 当前树枝节点如果是静态的，一旦加入了一个非静态子节点，改变当前树枝节点的 isStatic
      // 这里不处理树枝节点的进栈，因为当树枝节点出栈时，还有一次处理机会，那时它的 isStatic 已确定下来，不会再变
      if (currentBranch) {
        if (currentBranch.isStatic && !node.isStatic) {
          currentBranch.isStatic = constant.FALSE
        }
        // 当前树枝节点是简单节点，一旦加入了一个复杂子节点，当前树枝节点变为复杂节点
        if (!currentBranch.isComplex && node.isComplex) {
          currentBranch.isComplex = constant.TRUE
        }
      }
    }
    else {
      array.push(nodeStack, node)
    }

  },

  addTextChild = function (text: string) {
    // [注意]
    // 这里不能随便删掉
    // 因为收集组件的子节点会受影响，举个例子：
    // <Component>
    //
    // </Component>
    // 按现在的逻辑，这样的组件是没有子节点的，因为在这里过滤掉了，因此该组件没有 slot
    // 如果这里放开了，组件就会有一个 slot

    // trim 文本开始和结束位置的换行符
    text = text.replace(breaklinePattern, constant.EMPTY_STRING)
    if (text) {
      addChild(
        creator.createText(text)
      )
    }
  },

  htmlParsers = [
    function (content: string): string | void {
      if (!currentElement) {
        const match = content.match(tagPattern)
        // 必须以 <tag 开头才能继续
        // 如果 <tag 前面有别的字符，会走进第四个 parser
        if (match && match.index === 0) {
          const tag = match[2]
          if (match[1] === constant.RAW_SLASH) {
            /**
             * 处理可能存在的自闭合元素，如下
             *
             * <div>
             *    <input>
             * </div>
             */
            popSelfClosingElementIfNeeded(tag)
            popStack(nodeType.ELEMENT, tag)
          }
          else {

            /**
             * template 只能写在组件的第一级，如下：
             *
             * <Component>
             *   <template slot="xx">
             *     111
             *   </template>
             * </Component>
             */
            if (process.env.NODE_ENV === 'development') {
              if (tag === constant.RAW_TEMPLATE) {
                const lastNode = array.last(nodeStack)
                if (!lastNode || !(lastNode as Element).isComponent) {
                  fatal('<template> can only be used within an component children.')
                }
              }
            }

            const node = createElement(tag)

            addChild(node)
            currentElement = node
          }
          return match[0]
        }
      }
    },
    // 处理标签的 > 或 />，不论开始还是结束标签
    function (content: string): string | void {
      const match = content.match(selfClosingTagPattern)
      if (match) {

        // 处理开始标签的 > 或 />
        if (currentElement && !currentAttribute) {

          // 自闭合标签
          if (match[1] === constant.RAW_SLASH) {
            popStack(currentElement.type, currentElement.tag)
          }

          currentElement = constant.UNDEFINED
        }
        // 处理结束标签的 >
        return match[0]
      }
    },
    // 处理 attribute directive 的 name 部分
    function (content: string): string | void {
      // 当前在 element 层级
      if (currentElement && !currentAttribute) {
        const match = content.match(attributePattern)
        if (match) {

          // <div class="11 name="xxx"></div>
          // 这里会匹配上 xxx"，match[2] 就是那个引号
          if (process.env.NODE_ENV === 'development') {
            if (match[2]) {
              fatal(`The previous attribute is not end.`)
            }
          }

          let node: Attribute | Directive | Property, name = match[1]

          if (name === DIRECTIVE_MODEL || name === constant.RAW_TRANSITION) {
            node = creator.createDirective(
              constant.EMPTY_STRING,
              name
            )
          }
          // 这里要用 on- 判断前缀，否则 on 太容易重名了
          else if (string.startsWith(name, DIRECTIVE_ON + directiveSeparator)) {
            let event = slicePrefix(name, DIRECTIVE_ON + directiveSeparator)
            if (process.env.NODE_ENV === 'development') {
              if (!event) {
                fatal('The event name is required.')
              }
            }
            const [directiveName, diectiveModifier, extra] = string.camelize(event).split(constant.RAW_DOT)
            node = creator.createDirective(
              directiveName,
              DIRECTIVE_EVENT,
              diectiveModifier
            )
            // on-a.b.c
            if (process.env.NODE_ENV === 'development') {
              if (is.string(extra)) {
                fatal('Invalid event namespace.')
              }
            }
          }
          // 当一个元素绑定了多个事件时，可分别指定每个事件的 lazy
          // 当只有一个事件时，可简写成 lazy
          // <div on-click="xx" lazy-click
          else if (string.startsWith(name, DIRECTIVE_LAZY)) {
            let lazy = slicePrefix(name, DIRECTIVE_LAZY)
            if (string.startsWith(lazy, directiveSeparator)) {
              lazy = slicePrefix(lazy, directiveSeparator)
            }
            node = creator.createDirective(
              lazy ? string.camelize(lazy) : constant.EMPTY_STRING,
              DIRECTIVE_LAZY
            )
          }
          // 这里要用 o- 判断前缀，否则 o 太容易重名了
          else if (string.startsWith(name, DIRECTIVE_CUSTOM + directiveSeparator)) {
            const custom = slicePrefix(name, DIRECTIVE_CUSTOM + directiveSeparator)
            if (process.env.NODE_ENV === 'development') {
              if (!custom) {
                fatal('The directive name is required.')
              }
            }
            const [directiveName, diectiveModifier, extra] = string.camelize(custom).split(constant.RAW_DOT)
            node = creator.createDirective(
              directiveName,
              DIRECTIVE_CUSTOM,
              diectiveModifier
            )
            // o-a.b.c
            if (process.env.NODE_ENV === 'development') {
              if (is.string(extra)) {
                fatal('Invalid directive modifier.')
              }
            }
          }
          else {
            node = createAttribute(currentElement, name)
          }

          addChild(node)

          // 这里先记下，下一个 handler 要匹配结束引号
          startQuote = match[3]

          // 有属性值才需要设置 currentAttribute，便于后续收集属性值
          if (startQuote) {
            currentAttribute = node
          }
          else {
            popStack(node.type)
          }

          return match[0]
        }
      }
    },
    function (content: string): string | void {

      let text: string | void, match: RegExpMatchArray | null

      // 处理 attribute directive 的 value 部分
      if (currentAttribute && startQuote) {

        match = content.match(patternCache[startQuote] || (patternCache[startQuote] = new RegExp(startQuote)))

        // 有结束引号
        if (match) {
          text = string.slice(content, 0, match.index)
          addTextChild(text as string)

          text += startQuote

          // attribute directive 结束了
          // 此时如果一个值都没收集到，需设置一个空字符串
          // 否则无法区分 <div a b=""> 中的 a 和 b
          if (!currentAttribute.children) {
            addChild(
              creator.createText(constant.EMPTY_STRING)
            )
          }

          popStack(currentAttribute.type)
          currentAttribute = constant.UNDEFINED

        }
        // 没有结束引号，整段匹配
        // 如 id="1{{x}}2" 中的 1
        else if (blockMode !== BLOCK_MODE_NONE) {
          text = content
          addTextChild(text)
        }
        // 没找到结束引号
        else if (process.env.NODE_ENV === 'development') {
          fatal(`Unterminated quoted string in "${currentAttribute.name}".`)
        }

      }
      // 如果不加判断，类似 <div {{...obj}}> 这样写，会把空格当做一个属性
      // 收集文本只有两处：属性值、元素内容
      // 属性值通过上面的 if 处理过了，这里只需要处理元素内容
      else if (!currentElement) {

        // 获取 <tag 前面的字符
        match = content.match(tagPattern)

        // 元素层级的注释都要删掉
        if (match) {
          text = string.slice(content, 0, match.index)
          if (text) {
            addTextChild(
              text.replace(commentPattern, constant.EMPTY_STRING)
            )
          }
        }
        else {
          text = content
          addTextChild(
            text.replace(commentPattern, constant.EMPTY_STRING)
          )
        }

      }
      else {
        if (process.env.NODE_ENV === 'development') {
          if (string.trim(content)) {
            fatal(`Invalid character is found in <${currentElement.tag}> attribute level.`)
          }
        }
        text = content
      }
      return text
    },
  ],

  blockParsers = [
    // {{#each xx:index}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_EACH)) {
        if (process.env.NODE_ENV === 'development') {
          if (currentElement) {
            fatal(
              currentAttribute
                ? `The "each" block can't be appear in an attribute value.`
                : `The "each" block can't be appear in attribute level.`
            )
          }
        }
        source = slicePrefix(source, SYNTAX_EACH)
        const terms = source.replace(/\s+/g, constant.EMPTY_STRING).split(':')
        if (terms[0]) {
          const literal = string.trim(terms[0]),

          index = terms[1] ? string.trim(terms[1]) : constant.UNDEFINED,

          match = literal.match(rangePattern)

          if (match) {
            const parts = literal.split(rangePattern),
            from = exprCompiler.compile(parts[0]),
            to = exprCompiler.compile(parts[2])
            if (from && to) {
              return creator.createEach(
                from,
                to,
                string.trim(match[1]) === '=>',
                index
              )
            }
          }
          else {
            const expr = exprCompiler.compile(literal)
            if (expr) {
              return creator.createEach(
                expr,
                constant.UNDEFINED,
                constant.FALSE,
                index
              )
            }
          }
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid each`)
        }
      }
    },
    // {{#import name}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_IMPORT)) {
        source = slicePrefix(source, SYNTAX_IMPORT)
        if (source) {
          if (!currentElement) {
            return creator.createImport(source)
          }
          else if (process.env.NODE_ENV === 'development') {
            fatal(
              currentAttribute
                ? `The "import" block can't be appear in an attribute value.`
                : `The "import" block can't be appear in attribute level.`
            )
          }
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid import`)
        }
      }
    },
    // {{#partial name}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_PARTIAL)) {
        source = slicePrefix(source, SYNTAX_PARTIAL)
        if (source) {
          if (!currentElement) {
            return creator.createPartial(source)
          }
          else if (process.env.NODE_ENV === 'development') {
            fatal(
              currentAttribute
                ? `The "partial" block can't be appear in an attribute value.`
                : `The "partial" block can't be appear in attribute level.`
            )
          }
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid partial`)
        }
      }
    },
    // {{#if expr}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_IF)) {
        source = slicePrefix(source, SYNTAX_IF)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createIf(expr)
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid if`)
        }
      }
    },
    // {{else if expr}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_ELSE_IF)) {
        source = slicePrefix(source, SYNTAX_ELSE_IF)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createElseIf(expr)
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid else if`)
        }
      }
    },
    // {{else}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_ELSE)) {
        source = slicePrefix(source, SYNTAX_ELSE)
        if (!string.trim(source)) {
          return creator.createElse()
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`The "else" must not be followed by anything.`)
        }
      }
    },
    // {{...obj}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_SPREAD)) {
        source = slicePrefix(source, SYNTAX_SPREAD)
        const expr = exprCompiler.compile(source)
        if (expr) {
          if (currentElement && currentElement.isComponent) {
            return creator.createSpread(
              expr,
              expr.type === exprNodeType.IDENTIFIER
            )
          }
          else if (process.env.NODE_ENV === 'development') {
            fatal(`The spread can only be used by a component.`)
          }
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid spread`)
        }
      }
    },
    // {{expr}}
    function (source: string) {
      if (!SYNTAX_COMMENT.test(source)) {
        source = string.trim(source)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createExpression(expr, blockMode === BLOCK_MODE_SAFE)
        }
        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid expression`)
        }
      }
    },
  ],

  parseHtml = function (code: string) {
    while (code) {
      array.each(
        htmlParsers,
        function (parse) {
          const match = parse(code)
          if (match) {
            code = string.slice(code, match.length)
            return constant.FALSE
          }
        }
      )
    }
  },

  parseBlock = function (code: string) {
    if (string.charAt(code) === constant.RAW_SLASH) {

      /**
       * 处理可能存在的自闭合元素，如下
       *
       * {{#if xx}}
       *    <input>
       * {{/if}}
       */
      popSelfClosingElementIfNeeded()

      const name = string.slice(code, 1)

      let type = helper.name2Type[name], isCondition = constant.FALSE
      if (type === nodeType.IF) {
        const node = array.pop(ifStack)
        if (node) {
          type = node.type
          isCondition = constant.TRUE
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "if" block is closing, but it does't opened.`)
        }
      }

      const node: any = popStack(type)
      if (node && isCondition) {
        checkCondition(node)
      }
    }
    else {
      // 开始下一个 block 或表达式
      array.each(
        blockParsers,
        function (parse) {
          const node = parse(code)
          if (node) {
            addChild(node)
            return constant.FALSE
          }
        }
      )
    }
  },

  closeBlock = function () {

    // 确定开始和结束定界符能否配对成功，即 {{ 对 }}，{{{ 对 }}}
    // 这里不能动 openBlockIndex 和 closeBlockIndex，因为等下要用他俩 slice
    index = closeBlockIndex + 2

    // 这里要用 <=，因为很可能到头了
    if (index <= length) {

      if (index < length && string.charAt(content, index) === '}') {
        if (blockMode === BLOCK_MODE_UNSAFE) {
          nextIndex = index + 1
        }
        else {
          fatal(`{{ and }}} is not a pair.`)
        }
      }
      else {
        if (blockMode === BLOCK_MODE_SAFE) {
          nextIndex = index
        }
        else {
          fatal(`{{{ and }} is not a pair.`)
        }
      }

      array.pop(blockStack)

      // }} 左侧的位置
      addIndex(closeBlockIndex)

      openBlockIndex = string.indexOf(content, '{{', nextIndex)
      closeBlockIndex = string.indexOf(content, '}}', nextIndex)

      // 如果碰到连续的结束定界符，继续 close
      if (closeBlockIndex >= nextIndex
        && (openBlockIndex < 0 || closeBlockIndex < openBlockIndex)
      ) {
        return closeBlock()
      }

    }
    else {
      // 到头了
      return constant.TRUE
    }

  },

  addIndex = function (index: number) {
    if (!blockStack.length) {
      array.push(indexList, index)
    }
  }


  // 因为存在 mustache 注释内包含插值的情况
  // 这里把流程设计为先标记切片的位置，标记过程中丢弃无效的 block
  // 最后处理有效的 block
  while (constant.TRUE) {
    addIndex(nextIndex)
    openBlockIndex = string.indexOf(content, '{{', nextIndex)
    if (openBlockIndex >= nextIndex) {

      blockMode = BLOCK_MODE_SAFE

      // {{ 左侧的位置
      addIndex(openBlockIndex)

      // 跳过 {{
      openBlockIndex += 2

      // {{ 后面总得有内容吧
      if (openBlockIndex < length) {
        if (string.charAt(content, openBlockIndex) === '{') {
          blockMode = BLOCK_MODE_UNSAFE
          openBlockIndex++
        }
        // {{ 右侧的位置
        addIndex(openBlockIndex)
        // block 是否安全
        addIndex(blockMode)

        // 打开一个 block 就入栈一个
        array.push(blockStack, constant.TRUE)

        if (openBlockIndex < length) {

          closeBlockIndex = string.indexOf(content, '}}', openBlockIndex)

          if (closeBlockIndex >= openBlockIndex) {
            // 注释可以嵌套，如 {{！  {{xx}} {{! {{xx}} }}  }}
            nextIndex = string.indexOf(content, '{{', openBlockIndex)
            if (nextIndex < 0 || closeBlockIndex < nextIndex) {
              if (closeBlock()) {
                break
              }
            }
          }
          else if (process.env.NODE_ENV === 'development') {
            fatal('The end delimiter is not found.')
          }
        }
        else if (process.env.NODE_ENV === 'development') {
          // {{{ 后面没字符串了？
          fatal('Unterminated template literal.')
        }
      }
      else if (process.env.NODE_ENV === 'development') {
        // {{ 后面没字符串了？
        fatal('Unterminated template literal.')
      }

    }
    else {
      break
    }
  }

  for (let i = 0, length = indexList.length; i < length; i += 5) {
    index = indexList[i]

    // {{ 左侧的位置
    openBlockIndex = indexList[i + 1]
    if (openBlockIndex) {
      parseHtml(
        string.slice(content, index, openBlockIndex)
      )
    }

    // {{ 右侧的位置
    openBlockIndex = indexList[i + 2]
    blockMode = indexList[i + 3]
    closeBlockIndex = indexList[i + 4]
    if (closeBlockIndex) {

      code = string.trim(
        string.slice(content, openBlockIndex, closeBlockIndex)
      )

      // 不用处理 {{ }} 和 {{{ }}} 这种空 block
      if (code) {
        parseBlock(code)
      }

    }
    else {
      blockMode = BLOCK_MODE_NONE
      parseHtml(
        string.slice(content, index)
      )
    }
  }

  if (nodeStack.length) {

    /**
     * 处理可能存在的自闭合元素，如下
     *
     * <input>
     */
    popSelfClosingElementIfNeeded()

    if (process.env.NODE_ENV === 'development') {
      if (nodeStack.length) {
        fatal('Some nodes is still in the stack.')
      }
    }
  }

  if (nodeList.length > 0) {
    removeComment(nodeList)
  }

  return nodeList

}