import {
  SYNTAX_COMMENT,
  SYNTAX_EACH,
  SYNTAX_ELSE,
  SYNTAX_ELSE_IF,
  SYNTAX_IF,
  SYNTAX_IMPORT,
  SYNTAX_PARTIAL,
  SYNTAX_SPREAD,
  TAG_SLOT,
  TAG_PORTAL,
  TAG_FRAGMENT,
  TAG_TEMPLATE,
  ATTR_TO,
  ATTR_SLOT,
  ATTR_NAME,
  DIRECTIVE_ON,
  DIRECTIVE_EVENT,
  DIRECTIVE_LAZY,
  DIRECTIVE_MODEL,
  DIRECTIVE_TRANSITION,
  DIRECTIVE_CUSTOM,
  MAGIC_VAR_SCOPE,
  MAGIC_VAR_KEYPATH,
  MAGIC_VAR_LENGTH,
  MAGIC_VAR_EVENT,
  MAGIC_VAR_DATA,
  MODIFER_NATIVE,
} from 'yox-config/src/config'

import {
  isSelfClosing,
  isNativeElement,
  createAttribute,
  getAttributeDefaultValue,
  formatNativeAttributeValue,
  createElement,
  compatElement,
  setElementText,
  setElementHtml,
} from './platform/web'

import isDef from 'yox-common/src/function/isDef'
import toString from 'yox-common/src/function/toString'

import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as logger from 'yox-common/src/util/logger'
import * as constant from 'yox-common/src/util/constant'

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
import Each from './node/Each'
import Node from './node/Node'
import Branch from './node/Branch'
import Text from './node/Text'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Style from './node/Style'
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

// on-
directiveOnSeparator = DIRECTIVE_ON + directiveSeparator,

// lazy-
directiveLazySeparator = DIRECTIVE_LAZY + directiveSeparator,

// o-
directiveCustomSeparator = DIRECTIVE_CUSTOM + directiveSeparator,

// 解析 each 的 index
eachIndexPattern = /\s*:\s*([_$a-z]+)$/i,

// 调用的方法
methodPattern = /^[_$a-z]([\w]+)?$/i,

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
attributePattern = /^\s*([-$.:\w]+)(?:=(['"]))?/,

// 未结束的属性
// 比如 <div class="11 name="xxx"> 解析完 class 后，还剩一个 xxx"
notEndAttributePattern = /^[!=]*['"]/,

// 自闭合标签
selfClosingTagPattern = /^\s*(\/)?>/

/**
 * 截取前缀之后的字符串
 */
function slicePrefix(str: string, prefix: string): string {
  return string.trim(string.slice(str, prefix.length))
}

function toTextNode(node: Expression) {
  if (node.safe
    && node.expr.type === exprNodeType.LITERAL
  ) {
    return creator.createText(toString(
      (node.expr as ExpressionLiteral).value
    ))
  }
}

function isDangerousInterpolation(node: Node | void) {
  return node
    && node.type === nodeType.EXPRESSION
    && !(node as Expression).safe
}

function isSpecialAttr(element: Element, attr: Attribute) {
  return helper.specialAttrs[attr.name]
    || element.tag === TAG_SLOT && attr.name === ATTR_NAME
    || element.tag === TAG_PORTAL && attr.name === ATTR_TO
}

function removeComment(children: Node[]) {

  // 类似 <!-- xx {{name}} yy {{age}} zz --> 这样的注释里包含插值
  // 按照目前的解析逻辑，是根据定界符进行模板分拆
  // 一旦出现插值，children 长度必然大于 1

  let openIndex = -1,

  openText = constant.EMPTY_STRING,

  closeIndex = -1,

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
            openIndex = closeIndex = -1
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
}

export function compile(content: string): Branch[] {

  // 左安全定界符
  let leftSafeDelimiter = string.repeat(constant.PUBLIC_CONFIG.leftDelimiter, 2),

  // 右安全定界符
  rightSafeDelimiter = string.repeat(constant.PUBLIC_CONFIG.rightDelimiter, 2),

  leftUnsafeFlag = constant.PUBLIC_CONFIG.leftDelimiter,

  rightUnsafeFlag = constant.PUBLIC_CONFIG.rightDelimiter,

  nodeList: Branch[] = [],

  nodeStack: Branch[] = [],

  // 持有 if 节点，方便 if/elseif/else 出栈时，获取到 if 节点
  ifList: If[] = [],

  // 持有 if/elseif/else 节点
  ifStack: (If | ElseIf | Else)[] = [],

  // 持有 each 节点，方便 each/else 出栈时，获取到 each 节点
  eachList: Each[] = [],

  // 持有 each/else 节点
  eachStack: (Each | Else)[] = [],

  currentElement: Element | void,

  currentAttribute: Attribute | Style | Directive | void,

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

  attributeStartQuote: string | void,

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
      const lastElement = lastNode as Element
      if (lastElement.tag !== popingTagName
        && isSelfClosing(lastElement.tag)
      ) {
        popStack(lastElement.type, lastElement.tag)
      }
    }
  },

  popStack = function (type: number, tagName?: string) {

    const node = array.pop(nodeStack)

    // 出栈节点类型不匹配
    if (process.env.NODE_ENV === 'development') {
      if (!node || node.type !== type) {
        fatal(`The type of poping node is not expected.`)
      }
    }

    const branchNode = node as Branch,

    isElement = type === nodeType.ELEMENT,

    isAttribute = type === nodeType.ATTRIBUTE,

    isStyle = type === nodeType.STYLE,

    isDirective = type === nodeType.DIRECTIVE,

    parentBranchNode = array.last(nodeStack)

    if (process.env.NODE_ENV === 'development') {
      if (isElement
        && tagName
        && (branchNode as Element).tag !== tagName
      ) {
        fatal(`End tag is "${tagName}"，but start tag is "${(branchNode as Element).tag}".`)
      }
    }

    let { children } = branchNode

    // 先处理 children.length 大于 1 的情况，因为这里会有一些优化，导致最后的 children.length 不一定大于 0
    if (children && children.length > 1) {

      // 元素层级
      if (!currentElement) {
        removeComment(children)
        if (!children.length) {
          children = branchNode.children = constant.UNDEFINED
        }
      }

    }

    // 除了 helper.specialAttrs 里指定的特殊属性，attrs 里的任何节点都不能单独拎出来赋给 element
    // 因为 attrs 可能存在 if，所以每个 attr 最终都不一定会存在
    if (children) {

      // 优化单个子节点
      // 减少运行时的负担
      const onlyChild = children.length === 1 && children[0]

      if (onlyChild) {
        switch (onlyChild.type) {

          case nodeType.TEXT:
            if (isElement) {
              processElementSingleText(branchNode as Element, onlyChild as Text)
            }
            else if (currentElement) {
              if (isAttribute) {
                processAttributeSingleText(currentElement, branchNode as Attribute, onlyChild as Text)
              }
              else if (isStyle) {
                processStyleSingleText(currentElement, branchNode as Style, onlyChild as Text)
              }
              else if (isDirective) {
                processDirectiveSingleText(currentElement, branchNode as Directive, onlyChild as Text)
              }
            }
            break

          case nodeType.EXPRESSION:
            if (isElement) {
              processElementSingleExpression(branchNode as Element, onlyChild as Expression)
            }
            else if (currentElement && (isAttribute || isStyle || isDirective)) {
              processAttributeSingleExpression(currentElement, branchNode as any, onlyChild as Expression)
            }
            break

        }
      }

    }
    // 0 个子节点
    else if (currentElement) {
      if (isAttribute) {
        processAttributeEmptyChildren(currentElement, branchNode as Attribute)
      }
      else if (isStyle) {
        processStyleEmptyChildren(currentElement, branchNode as Style)
      }
      else if (isDirective) {
        processDirectiveEmptyChildren(currentElement, branchNode as Directive)
      }
    }

    if (branchNode.isVirtual && !branchNode.children) {
      replaceChild(branchNode)
    }

    if (isElement) {
      checkElement(branchNode as Element)
    }
    else if (currentElement) {
      if (isAttribute) {
        checkAttribute(currentElement, branchNode as Attribute)
      }
    }

    // 弹出过程可能会修改 branchNode.isStatic，因此这段放在最后执行
    // 当 branchNode 出栈时，它的 isStatic 就彻底固定下来，不会再变了
    // 这时如果它不是静态节点，则父节点也不是静态节点
    if (parentBranchNode
      && parentBranchNode.isStatic
      && !branchNode.isStatic
    ) {
      parentBranchNode.isStatic = constant.FALSE
    }

    return branchNode

  },

  processElementSingleText = function (element: Element, child: Text) {

    // 需要在这特殊处理的是 html 实体
    // 但这只是 WEB 平台的特殊逻辑，所以丢给 platform 处理
    if (isNativeElement(element)
      && setElementText(element, child.text)
    ) {
      element.children = constant.UNDEFINED
    }

  },

  processElementSingleExpression = function (element: Element, child: Expression) {

    if (isNativeElement(element)) {
      if (child.safe && setElementText(element, child.expr)
        || !child.safe && setElementHtml(element, child.expr)
      ) {
        element.children = constant.UNDEFINED
      }
    }

  },

  processStyleEmptyChildren = function (element: Element, style: Style) {

    // 如果不写值，直接忽略
    replaceChild(style)

  },

  processStyleSingleText = function (element: Element, style: Style, child: Text) {

    if (child.text) {
      style.value = child.text
      style.children = constant.UNDEFINED
    }
    else {
      // 如果是 style=""，直接忽略
      replaceChild(style)
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

  processAttributeSingleText = function (element: Element, attr: Attribute, child: Text) {

    attr.value = element.isComponent
      ? child.text
      : formatNativeAttributeValue(attr.name, child.text)

    attr.children = constant.UNDEFINED

  },

  processAttributeSingleExpression = function (element: Element, attr: Attribute | Style | Directive, child: Expression) {

    const { expr } = child

    if (expr.type === exprNodeType.LITERAL) {
      let value = (expr as ExpressionLiteral).value
      if (!element.isComponent && attr.type === nodeType.ATTRIBUTE) {
        value = formatNativeAttributeValue((attr as Attribute).name, value)
      }
      attr.value = value
    }
    else {
      attr.expr = expr
    }

    attr.children = constant.UNDEFINED

  },

  processDirectiveEmptyChildren = function (element: Element, directive: Directive) {

    directive.value = constant.TRUE

  },

  processDirectiveSingleText = function (element: Element, directive: Directive, child: Text) {

    let { ns } = directive, { text } = child,

    // model="xx" model="this.x" 值只能是标识符或 Member
    isModel = ns === DIRECTIVE_MODEL,

    // lazy 的值必须是大于 0 的数字
    isLazy = ns === DIRECTIVE_LAZY,

    // 校验事件名称
    // 且命名空间不能用 native
    isEvent = ns === DIRECTIVE_EVENT,

    // 自定义指令运行不合法的表达式
    isCustom = ns === DIRECTIVE_CUSTOM,

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
          const methodName = (expr as ExpressionCall).name
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
      if (!isCustom) {
        throw error
      }
      directive.value = text
    }

    directive.children = constant.UNDEFINED

  },

  checkCondition = function (condition: If | Each) {

    // 这里会去掉没有子节点的空分支

    let currentNode: any = condition,

    nodeList = [],

    hasNext = constant.FALSE,

    hasChildren = constant.FALSE

    // 转成数组，方便下一步从后往前遍历
    while (constant.TRUE) {
      array.push(nodeList, currentNode)
      if (currentNode.next) {
        currentNode = currentNode.next
      }
      else {
        break
      }
    }

    array.each(
      nodeList,
      function (node: any) {

        // 当前分支有子节点
        if (node.children) {
          // 从后往前遍历第一次发现非空分支
          // 此时，可以删掉后面的空分支
          if (!hasNext && node.next) {
            delete node.next
          }
          hasChildren = hasNext = constant.TRUE
        }

      },
      constant.TRUE
    )

    // 所有分支都没有子节点，删掉整个 if
    if (!hasChildren) {
      replaceChild(condition)
    }

  },

  checkElement = function (element: Element) {

    const { tag, slot } = element,

    isTemplate = tag === TAG_TEMPLATE,

    isFragment = tag === TAG_FRAGMENT,

    isPortal = tag === TAG_PORTAL

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

    // 没有子节点，则意味着这个元素没任何意义
    if ((isTemplate || isFragment || isPortal) && !element.children) {
      replaceChild(element)
    }
    // 处理浏览器兼容问题
    else if (tag !== TAG_SLOT) {
      compatElement(element)
    }

  },

  checkAttribute = function (element: Element, attr: Attribute) {

    const { name, value } = attr,

    isSlot = name === ATTR_SLOT

    if (process.env.NODE_ENV === 'development') {
      if (isSlot) {
        // 只能是 <template> 和 其他原生标签
        if (helper.specialTag2VNodeType[element.tag]) {
          fatal(`The "slot" attribute can't be used in <${element.tag}>.`)
        }
      }
    }

    if (isSpecialAttr(element, attr)) {

      const isStringValueRequired = isSlot

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

      if (attr.isStatic) {
        attr.isStatic = constant.FALSE
      }
    }

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

    let type = node.type,

    currentBranch = array.last(nodeStack),

    lastIfBranch: (If | void) = constant.UNDEFINED,

    lastElseIfBranch: (ElseIf | void) = constant.UNDEFINED,

    lastEachBranch: (Each | void) = constant.UNDEFINED

    if (type === nodeType.ELSE_IF) {

      const lastNode = array.last(ifStack)

      if (lastNode) {
        // lastNode 只能是 if 或 else if 节点
        if (lastNode.type === nodeType.IF) {
          lastIfBranch = lastNode as If
        }
        else if (lastNode.type === nodeType.ELSE_IF) {
          lastElseIfBranch = lastNode as ElseIf
        }
        // 上一个节点是 else，又加了一个 else if
        else if (process.env.NODE_ENV === 'development') {
          fatal('The "else" block must not be followed by an "else if" block.')
        }
      }
      else if (process.env.NODE_ENV === 'development') {
        fatal('The "if" block is required.')
      }

    }
    else if (type === nodeType.ELSE) {

      const lastIfNode = array.last(ifStack),

      lastEachNode = array.last(eachStack)

      if (lastIfNode && currentBranch === lastIfNode) {
        // lastIfNode 只能是 if 或 else if 节点
        if (lastIfNode.type === nodeType.IF) {
          lastIfBranch = lastIfNode as If
        }
        else if (lastIfNode.type === nodeType.ELSE_IF) {
          lastElseIfBranch = lastIfNode as ElseIf
        }
        // 上一个节点是 else，又加了一个 else
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "else" block can't appear more than once in a conditional statement.`)
        }
      }
      else if (lastEachNode && currentBranch === lastEachNode) {
        // lastEachNode 只能是 each 节点
        if (lastEachNode.type === nodeType.EACH) {
          lastEachBranch = lastEachNode as Each
        }
        // 上一个节点是 else，又加了一个 else
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "else" block can't appear more than once in a conditional statement.`)
        }
      }
      else if (process.env.NODE_ENV === 'development') {
        // 只有 else 没有对应的 if 或 each，则提示缺少 if，毕竟 if 用的更多
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

          // 属性层级不能使用危险插值
          if (process.env.NODE_ENV === 'development') {
            if (isDangerousInterpolation(node)) {
              fatal('The dangerous interpolation must be the only child of a HTML element.')
            }
          }

          // node 没法转型，一堆可能的类型怎么转啊...
          array.push(
            currentElement.attrs || (currentElement.attrs = []),
            node as any
          )

        }
        else {

          // 这个分支用于收集 children

          if (process.env.NODE_ENV === 'development') {

            // 指令的值只支持字面量，不支持插值
            if (currentAttribute
              && currentAttribute.type === nodeType.DIRECTIVE
              && type !== nodeType.TEXT
            ) {
              // 不支持 on-click="1{{xx}}2" 或是 on-click="1{{#if x}}x{{else}}y{{/if}}2"
              // 1. 很难做性能优化
              // 2. 全局搜索不到事件名，不利于代码维护
              // 3. 不利于编译成静态函数
              fatal(`For performance, "${leftSafeDelimiter}" and "${rightSafeDelimiter}" are not allowed in directive value.`)
            }
             // model 指令不能写在 if 里，影响节点的静态结构
            else if (type === nodeType.DIRECTIVE
              && (node as Directive).ns === DIRECTIVE_MODEL
              && currentBranch !== currentElement
            ) {
              fatal(`The "model" can't be used in an if block.`)
            }

          }

          const children = currentBranch.children || (currentBranch.children = [ ]),
          lastChild = array.last(children)

          // 如果表达式是安全插值的字面量，可以优化成字符串
          if (type === nodeType.EXPRESSION
            // 在元素的子节点中，则直接转成字符串
            && (!currentElement
              // 在元素的属性中，如果同级节点大于 0 个（即至少存在一个），则可以转成字符串
              || (currentAttribute && children.length > 0)
            )
          ) {
            const textNode = toTextNode(node as Expression)
            if (textNode) {
              node = textNode
              type = textNode.type
            }
          }

          // 连续添加文本节点，则直接合并
          if (lastChild
            && type === nodeType.TEXT
          ) {
            // 合并两个文本节点
            if (lastChild.type === nodeType.TEXT) {
              (lastChild as Text).text += (node as Text).text
              return
            }
            // 前一个是字面量的表达式，也可以合并节点
            // 比如 attr="{{true}}1"，先插入了一个 true 字面量表达式，然后再插入一个文本时，可以合并
            if (lastChild.type === nodeType.EXPRESSION) {
              const textNode = toTextNode(lastChild as Expression)
              if (textNode) {
                children[children.length - 1] = textNode
                textNode.text += (node as Text).text
                return
              }
            }
          }

          // 危险插值，必须独占一个 html 元素
          // <div>{{{html}}}</div>
          if (process.env.NODE_ENV === 'development') {
            if (isDangerousInterpolation(node)) {
              // 前面不能有别的 child，危险插值必须独占父元素
              if (lastChild) {
                fatal('The dangerous interpolation must be the only child of a HTML element.')
              }
              // 危险插值的父节点必须是 html element
              else if (!isNativeElement(currentBranch)) {
                fatal('The dangerous interpolation must be the only child of a HTML element.')
              }
            }
            // 后面不能有别的 child，危险插值必须独占父元素
            else if (isDangerousInterpolation(lastChild)) {
              fatal('The dangerous interpolation must be the only child of a HTML element.')
            }
          }

          array.push(children, node)

        }
      }
      else {
        if (process.env.NODE_ENV === 'development') {
          if (isDangerousInterpolation(node)) {
            fatal('The dangerous interpolation must be under a HTML element.')
          }
        }
        array.push(nodeList, node)
      }

    }

    if (type === nodeType.IF) {
      array.push(ifList, node)
      array.push(ifStack, node)
    }
    else if (type === nodeType.EACH) {
      array.push(eachList, node)
      array.push(eachStack, node)
    }
    else if (lastIfBranch) {
      lastIfBranch.next = node
      ifStack[ifStack.length - 1] = node
      popStack(lastIfBranch.type)
    }
    else if (lastElseIfBranch) {
      lastElseIfBranch.next = node
      ifStack[ifStack.length - 1] = node
      popStack(lastElseIfBranch.type)
    }
    else if (lastEachBranch) {
      lastEachBranch.next = node
      eachStack[eachStack.length - 1] = node
      popStack(lastEachBranch.type)
    }

    if (node.isLeaf) {
      // 当前树枝节点如果是静态的，一旦加入了一个非静态子节点，改变当前树枝节点的 isStatic
      // 这里不处理树枝节点的进栈，因为当树枝节点出栈时，还有一次处理机会，那时它的 isStatic 已确定下来，不会再变
      if (currentBranch) {
        if (currentBranch.isStatic && !node.isStatic) {
          currentBranch.isStatic = constant.FALSE
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
          let tag = match[2]
          // 结束标签
          if (match[1] === constant.RAW_SLASH) {
            /**
             * 处理可能存在的自闭合元素，如下
             *
             * <div>
             *    <input>
             * </div>
             */
            popSelfClosingElementIfNeeded(tag)

            // 等到 > 字符才算真正的结束
            currentElement = popStack(nodeType.ELEMENT, tag) as Element

          }
          // 开始标签
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
              if (tag === TAG_TEMPLATE) {
                const lastNode = array.last(nodeStack)
                if (!lastNode || !(lastNode as Element).isComponent) {
                  fatal('<template> can only be used within an component children.')
                }
              }
            }

            let dynamicTag: ExpressionNode | void

            // 如果以 $ 开头，表示动态组件
            if (string.charAt(tag) === constant.RAW_DOLLAR) {

              // 编译成表达式
              tag = string.slice(tag, 1)

              dynamicTag = exprCompiler.compile(tag)
              // 表达式必须是标识符类型
              if (process.env.NODE_ENV === 'development') {
                if (dynamicTag) {
                  if (dynamicTag.type !== exprNodeType.IDENTIFIER) {
                    fatal(`The dynamic component "${tag}" is not a valid identifier.`)
                  }
                }
                else {
                  fatal(`The dynamic component "${tag}" is not a valid expression.`)
                }
              }

            }

            const node = createElement(tag, dynamicTag)

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
        // 处理结束标签的 >
        if (currentElement && !currentAttribute) {

          // 自闭合标签
          if (match[1] === constant.RAW_SLASH) {
            popStack(currentElement.type, currentElement.tag)
          }

          currentElement = constant.UNDEFINED

          return match[0]

        }

        // 如果只是写了一个 > 字符
        // 比如 <div>></div>
        // 则交给其他 parser 处理

      }
    },
    // 处理 attribute directive 的 name 部分
    function (content: string): string | void {
      // 当前在 element 层级
      if (currentElement && !currentAttribute) {

        if (process.env.NODE_ENV === 'development') {
          const match = content.match(notEndAttributePattern)
          if (match) {
            fatal(`The previous attribute is not end.`)
          }
        }

        const match = content.match(attributePattern)
        if (match) {

          let node: Attribute | Style | Directive, name = match[1]

          if (name === DIRECTIVE_MODEL || name === DIRECTIVE_TRANSITION) {
            node = creator.createDirective(
              constant.EMPTY_STRING,
              name
            )
          }
          // 这里要用 on- 判断前缀，否则 on 太容易重名了
          else if (string.startsWith(name, directiveOnSeparator)) {
            const event = slicePrefix(name, directiveOnSeparator)
            if (process.env.NODE_ENV === 'development') {
              if (!event) {
                fatal('The event name is required.')
              }
            }
            const parts = string.camelize(event).split(constant.RAW_DOT)
            node = creator.createDirective(
              parts[0],
              DIRECTIVE_EVENT,
              parts[1]
            )
            // on-a.b.c
            if (process.env.NODE_ENV === 'development') {
              if (parts.length > 2) {
                fatal('Invalid event namespace.')
              }
            }
          }
          // 当一个元素绑定了多个事件时，可分别指定每个事件的 lazy
          // 当只有一个事件时，可简写成 lazy
          // <div on-click="xx" lazy-click
          else if (name === DIRECTIVE_LAZY) {
            node = creator.createDirective(
              constant.EMPTY_STRING,
              DIRECTIVE_LAZY
            )
          }
          else if (string.startsWith(name, directiveLazySeparator)) {
            const lazy = slicePrefix(name, directiveLazySeparator)
            if (process.env.NODE_ENV === 'development') {
              if (!lazy) {
                fatal('The lazy name is required.')
              }
            }
            node = creator.createDirective(
              string.camelize(lazy),
              DIRECTIVE_LAZY
            )
          }
          // 自定义指令
          else if (string.startsWith(name, directiveCustomSeparator)) {
            const custom = slicePrefix(name, directiveCustomSeparator)
            if (process.env.NODE_ENV === 'development') {
              if (!custom) {
                fatal('The directive name is required.')
              }
            }
            const parts = string.camelize(custom).split(constant.RAW_DOT)
            node = creator.createDirective(
              parts[0],
              DIRECTIVE_CUSTOM,
              parts[1]
            )
            // o-a.b.c
            if (process.env.NODE_ENV === 'development') {
              if (parts.length > 2) {
                fatal('Invalid directive modifier.')
              }
            }
          }
          else {
            // 处理类似 xml:name="value" 的命名空间
            const parts = name.split(':')
            node = parts.length === 2
              ? createAttribute(
                  currentElement,
                  parts[1],
                  parts[0]
                )
              : createAttribute(
                  currentElement,
                  name
                )
          }

          addChild(node)

          // 这里先记下，下一个 handler 要匹配结束引号
          attributeStartQuote = match[2]

          // 有属性值才需要设置 currentAttribute，便于后续收集属性值
          if (attributeStartQuote) {
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
      if (currentAttribute && attributeStartQuote) {

        match = content.match(patternCache[attributeStartQuote] || (patternCache[attributeStartQuote] = new RegExp(attributeStartQuote)))

        // 有结束引号
        if (match) {
          text = string.slice(content, 0, match.index)
          addTextChild(text as string)

          // 收集 value 到此结束
          // 此时如果一个值都没收集到，需设置一个空字符串
          // 否则无法区分 <div a b=""> 中的 a 和 b
          if (!currentAttribute.children) {
            addChild(
              creator.createText(constant.EMPTY_STRING)
            )
          }

          text += attributeStartQuote

          popStack(currentAttribute.type)
          currentAttribute = constant.UNDEFINED

        }
        // 没有结束引号，整段匹配
        // 比如 <div name="1{{a}}2"> 中的 1
        else {
          text = content
          addTextChild(text)
        }

      }
      // 如果不加判断，类似 <div {{...obj}}> 这样写，会把空格当做一个属性
      // 收集文本只有两处：属性值、元素内容
      // 属性值通过上面的 if 处理过了，这里只需要处理元素内容
      else if (!currentElement) {

        // 获取 <tag 前面的字符
        match = content.match(tagPattern)

        text = match
          ? string.slice(content, 0, match.index)
          : content

        // 元素层级的 HTML 注释都要删掉
        if (text) {
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
        source = string.trim(slicePrefix(source, SYNTAX_EACH))

        let literal = source, index: string | void = constant.UNDEFINED, match = source.match(eachIndexPattern)

        if (match) {
          index = match[1]
          literal = string.slice(source, 0, -1 * match[0].length)
        }

        if (process.env.NODE_ENV === 'development') {
          if (!literal || index === constant.EMPTY_STRING) {
            fatal(`Invalid each`)
          }
          if (index === MAGIC_VAR_SCOPE
            || index === MAGIC_VAR_KEYPATH
            || index === MAGIC_VAR_LENGTH
            || index === MAGIC_VAR_EVENT
            || index === MAGIC_VAR_DATA
          ) {
            fatal(`The each index can't be "${index}".`)
          }
        }

        match = literal.match(rangePattern)
        if (match) {
          const parts = literal.split(rangePattern),
          from = exprCompiler.compile(parts[0]),
          to = exprCompiler.compile(parts[2])
          if (from && to) {
            return creator.createEach(
              from,
              to,
              match[1] === '=>',
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

        if (process.env.NODE_ENV === 'development') {
          fatal(`Invalid each`)
        }

      }
    },
    // {{#import name}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_IMPORT)) {
        source = slicePrefix(source, SYNTAX_IMPORT)
        if (process.env.NODE_ENV === 'development') {
          if (!source) {
            fatal(`Invalid import`)
          }
        }
        if (process.env.NODE_ENV === 'development') {
          if (currentElement) {
            fatal(
              currentAttribute
                ? `The "import" block can't be appear in an attribute value.`
                : `The "import" block can't be appear in attribute level.`
            )
          }
        }
        return creator.createImport(source)
      }
    },
    // {{#partial name}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_PARTIAL)) {
        source = slicePrefix(source, SYNTAX_PARTIAL)
        if (process.env.NODE_ENV === 'development') {
          if (!source) {
            fatal(`Invalid partial`)
          }
        }
        if (process.env.NODE_ENV === 'development') {
          if (currentElement) {
            fatal(
              currentAttribute
                ? `The "partial" block can't be appear in an attribute value.`
                : `The "partial" block can't be appear in attribute level.`
            )
          }
        }
        return creator.createPartial(source)
      }
    },
    // {{#if expr}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_IF)) {
        source = slicePrefix(source, SYNTAX_IF)
        const expr = exprCompiler.compile(source)
        if (process.env.NODE_ENV === 'development') {
          if (!expr) {
            fatal(`Invalid if`)
          }
        }
        return creator.createIf(expr)
      }
    },
    // {{else if expr}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_ELSE_IF)) {
        source = slicePrefix(source, SYNTAX_ELSE_IF)
        const expr = exprCompiler.compile(source)
        if (process.env.NODE_ENV === 'development') {
          if (!expr) {
            fatal(`Invalid else if`)
          }
        }
        return creator.createElseIf(expr)
      }
    },
    // {{else}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_ELSE)) {
        source = slicePrefix(source, SYNTAX_ELSE)
        if (process.env.NODE_ENV === 'development') {
          if (string.trim(source)) {
            fatal(`The "else" must not be followed by anything.`)
          }
        }
        return creator.createElse()
      }
    },
    // {{...obj}}
    function (source: string) {
      if (string.startsWith(source, SYNTAX_SPREAD)) {
        source = slicePrefix(source, SYNTAX_SPREAD)
        const expr = exprCompiler.compile(source)
        if (process.env.NODE_ENV === 'development') {
          if (!expr) {
            fatal(`Invalid spread`)
          }
        }
        if (currentElement && currentElement.isComponent) {
          return creator.createSpread(expr)
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The spread can only be used by a component.`)
        }
      }
    },
    // {{expr}}
    function (source: string) {
      if (!SYNTAX_COMMENT.test(source)) {
        source = string.trim(source)
        const expr = exprCompiler.compile(source)
        if (process.env.NODE_ENV === 'development') {
          if (!expr) {
            fatal(`Invalid expression`)
          }
        }
        return creator.createExpression(
          expr,
          blockMode === BLOCK_MODE_SAFE
        )
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

      let type = helper.name2Type[name], ifNode: If | void = constant.UNDEFINED, eachNode: Each | void = constant.UNDEFINED
      if (type === nodeType.IF) {
        const node = array.pop(ifStack)
        if (node) {
          type = node.type
          ifNode = array.pop(ifList)
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "if" block is closing, but it's not open yet.`)
        }
      }
      else if (type === nodeType.EACH) {
        const node = array.pop(eachStack)
        if (node) {
          type = node.type
          eachNode = array.pop(eachList)
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`The "each" block is closing, but it's not open yet.`)
        }
      }

      popStack(type)
      if (ifNode) {
        checkCondition(ifNode)
      }
      else if (eachNode) {
        checkCondition(eachNode)
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
    index = closeBlockIndex + rightSafeDelimiter.length

    // 这里要用 <=，因为很可能到头了
    if (index <= length) {

      if (index < length && string.charAt(content, index) === rightUnsafeFlag) {
        if (blockMode === BLOCK_MODE_UNSAFE) {
          nextIndex = index + 1
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`${leftSafeDelimiter} and ${rightUnsafeFlag}${rightSafeDelimiter} is not a pair.`)
        }
      }
      else {
        if (blockMode === BLOCK_MODE_SAFE) {
          nextIndex = index
        }
        else if (process.env.NODE_ENV === 'development') {
          fatal(`${leftSafeDelimiter}${leftUnsafeFlag} and ${rightSafeDelimiter} is not a pair.`)
        }
      }

      array.pop(blockStack)

      // 结束定界符左侧的位置
      addIndex(closeBlockIndex)

      // 此时 nextIndex 位于结束定界符的右侧

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

    // 当前内容位置
    addIndex(nextIndex)

    // 寻找下一个开始定界符和结束定界符
    openBlockIndex = string.indexOf(content, leftSafeDelimiter, nextIndex)
    closeBlockIndex = string.indexOf(content, rightSafeDelimiter, nextIndex)

    // 如果是连续的结束定界符，比如 {{！{{xx}} }}
    // 需要调用 closeBlock
    if (closeBlockIndex >= nextIndex
      && (openBlockIndex < 0 || closeBlockIndex < openBlockIndex)
    ) {
      if (closeBlock()) {
        break
      }
    }
    // 解析下一个 block
    else if (openBlockIndex >= nextIndex) {

      // 当前为安全插值模式
      blockMode = BLOCK_MODE_SAFE

      // 开始定界符左侧的位置
      addIndex(openBlockIndex)

      // 跳过开始定界符
      openBlockIndex += leftSafeDelimiter.length

      // 开始定界符后面总得有内容吧
      if (openBlockIndex < length) {
        // 判断是否为危险插值模式
        if (string.charAt(content, openBlockIndex) === leftUnsafeFlag) {
          blockMode = BLOCK_MODE_UNSAFE
          openBlockIndex++
        }
        // 开始定界符右侧的位置
        addIndex(openBlockIndex)
        // block 模式
        addIndex(blockMode)

        // 打开一个 block 就入栈一个
        array.push(blockStack, constant.TRUE)

        if (openBlockIndex < length) {

          // 结束定界符左侧的位置
          closeBlockIndex = string.indexOf(content, rightSafeDelimiter, openBlockIndex)

          if (closeBlockIndex >= openBlockIndex) {
            nextIndex = string.indexOf(content, leftSafeDelimiter, openBlockIndex)
            // 判断结束定界符是否能匹配开始定界符
            // 因为支持 mustache 注释，而注释又能嵌套，如 {{！  {{xx}} {{! {{xx}} }}  }}
            // 当 {{ 和 }} 中间还有 {{ 时，则表示无法匹配，需要靠下一次循环再次解析
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

  // 开始处理有效 block 之前，重置 blockMode
  blockMode = BLOCK_MODE_NONE

  for (let i = 0, length = indexList.length; i < length; i += 5) {
    // 每个单元有 5 个 index
    // [当前内容位置，下一个开始定界符的左侧, 下一个开始定界符的右侧, block 模式, 下一个结束定界符的左侧]
    index = indexList[i]

    // 开始定界符左侧的位置
    openBlockIndex = indexList[i + 1]
    // 如果 openBlockIndex 存在，则后续 3 个 index 都存在
    if (isDef(openBlockIndex)) {

      parseHtml(
        string.slice(content, index, openBlockIndex)
      )

      // 开始定界符右侧的位置
      openBlockIndex = indexList[i + 2]
      blockMode = indexList[i + 3]
      // 结束定界符左侧的位置
      closeBlockIndex = indexList[i + 4]

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