import * as config from 'yox-config/index'

import toNumber from 'yox-common/src/function/toNumber'

import * as is from 'yox-common/src/util/is'
import * as env from 'yox-common/src/util/env'
import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as logger from 'yox-common/src/util/logger'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as exprCompiler from 'yox-expression-compiler/src/compiler'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'

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

// 缓存编译模板
compileCache = {},

// 缓存编译正则
patternCache = {},

// 指令分隔符，如 on-click 和 lazy-click
directiveSeparator = '-',

// 标签
tagPattern = /<(\/)?([$a-z][-a-z0-9]*)/i,

// 注释
commentPattern = /<!--[\s\S]*?-->/,

// 属性的 name
attributePattern = /^\s*([-:\w]+)(['"])?(?:=(['"]))?/,

// 首字母大写，或中间包含 -
componentNamePattern = /^[$A-Z]|-/,

// 自闭合标签
selfClosingTagPattern = /^\s*(\/)?>/,

// 常见的自闭合标签
selfClosingTagNames = 'area,base,embed,track,source,param,input,col,img,br,hr'.split(','),

// 常见的 svg 标签
svgTagNames = 'svg,g,defs,desc,metadata,symbol,use,image,path,rect,circle,line,ellipse,polyline,polygon,text,tspan,tref,textpath,marker,pattern,clippath,mask,filter,cursor,view,animate,font,font-face,glyph,missing-glyph,foreignObject'.split(','),

// 常见的字符串类型的属性
// 注意：autocomplete,autocapitalize 不是布尔类型
stringProperyNames = 'id,class,name,value,for,accesskey,title,style,src,type,href,target,alt,placeholder,preload,poster,wrap,accept,pattern,dir,autocomplete,autocapitalize'.split(','),

// 常见的数字类型的属性
numberProperyNames = 'min,minlength,max,maxlength,step,width,height,size,rows,cols,tabindex'.split(','),

// 常见的布尔类型的属性
booleanProperyNames = 'disabled,checked,required,multiple,readonly,autofocus,autoplay,controls,loop,muted,novalidate,draggable,hidden,spellcheck'.split(','),

// 某些属性 attribute name 和 property name 不同
attr2Prop = {}

// 列举几个常见的
attr2Prop['for'] = 'htmlFor'
attr2Prop['class'] = 'className'
attr2Prop['accesskey'] = 'accessKey'
attr2Prop['style'] = 'style.cssText'
attr2Prop['novalidate'] = 'noValidate'
attr2Prop['readonly'] = 'readOnly'
attr2Prop['tabindex'] = 'tabIndex'
attr2Prop['minlength'] = 'minLength'
attr2Prop['maxlength'] = 'maxLength'

/**
 * 截取前缀之后的字符串
 */
function slicePrefix(str: string, prefix: string): string {
  return string.trim(string.slice(str, prefix.length))
}

/**
 * trim 文本开始和结束位置的换行符
 *
 * 换行符比较神奇，有时候你明明看不到换行符，却真的存在一个，那就是 \r
 *
 */
function trimBreakline(content: string): string {
  return content.replace(
    /^\s*[\n\r]\s*|\s*[\n\r]\s*$/g,
    env.EMPTY_STRING
  )
}

export function compile(content: string): Node[] {

  let nodeList: Node[] = compileCache[content]
  if (nodeList) {
    return nodeList
  }

  nodeList = []

  let nodeStack: Node[] = [],

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

  code: string,

  startQuote: string | void,

  fatal = function (msg: string) {
    if (process.env.NODE_ENV === 'dev') {
      logger.fatal(`Error compiling ${env.RAW_TEMPLATE}:\n${content}\n- ${msg}`)
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
    if (lastNode
      && lastNode.type === nodeType.ELEMENT
      && lastNode.tag !== popingTagName
      && array.has(selfClosingTagNames, lastNode.tag)
    ) {
      popStack(lastNode.type, lastNode.tag)
    }
  },

  popStack = function (type: number, tagName?: string) {

    const node: Branch = array.pop(nodeStack)

    if (node && node.type === type) {

      const { children } = node,

      // 优化单个子节点
      child = children && children.length === 1 && children[0],

      isElement = type === nodeType.ELEMENT,

      isAttribute = type === nodeType.ATTRIBUTE,

      isProperty = type === nodeType.PROPERTY,

      isDirective = type === nodeType.DIRECTIVE

      const currentBranch: Branch = array.last(nodeStack)
      if (currentBranch) {
        if (currentBranch.isStatic && !node.isStatic) {
          currentBranch.isStatic = env.FALSE
        }
        if (!currentBranch.isComplex
          && (node.isComplex || isElement)
        ) {
          currentBranch.isComplex = env.TRUE
        }
      }

      if (process.env.NODE_ENV === 'dev') {
        if (isElement) {
          const element = node as Element
          if (tagName && element.tag !== tagName) {
            fatal(`结束标签是${tagName}，开始标签却是${element.tag}`)
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
        // 不支持 on-click="1{{xx}}2" 或是 on-click="1{{#if x}}x{{else}}y{{/if}}2"
        // 1. 很难做性能优化
        // 2. 全局搜索不到事件名，不利于代码维护
        // 3. 不利于编译成静态函数
        if (process.env.NODE_ENV === 'dev') {
          if (isDirective) {
            fatal(`指令的值不能用插值或 if 语法`)
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
      else if (currentElement && isAttribute && isSpecialAttr(currentElement, node as Attribute)) {
        bindSpecialAttr(currentElement, node as Attribute)
      }

      return node

    }
    else if (process.env.NODE_ENV === 'dev') {
      fatal(`出栈节点类型不匹配`)
    }
  },

  processElementSingleText = function (element: Element, child: Text) {

    // processElementSingleText 和 processElementSingleExpression
    // 不把元素子节点智能转换为 textContent property
    // 因为子节点还有 <div>1{{a}}{{b}}</div> 这样的情况
    // 还是在序列化的时候统一处理比较好

  },

  processElementSingleExpression = function (element: Element, child: Expression) {

    if (!element.isComponent && !element.slot && !child.safe) {
      element.html = child.expr
      element.children = env.UNDEFINED
    }

  },

  processPropertyEmptyChildren = function (element: Element, prop: Property) {

    if (prop.hint === config.HINT_BOOLEAN) {
      prop.value = env.TRUE
    }
    else {
      // string 或 number 类型的属性，如果不写值，直接忽略
      replaceChild(prop)
    }

  },

  processPropertySingleText = function (prop: Property, child: Text) {

    const { text } = child

    if (prop.hint === config.HINT_NUMBER) {
      prop.value = toNumber(text)
    }
    else if (prop.hint === config.HINT_BOOLEAN) {
      prop.value = text === env.RAW_TRUE || text === prop.name
    }
    else {
      prop.value = text
    }

    prop.children = env.UNDEFINED

  },

  processPropertySingleExpression = function (prop: Property, child: Expression) {

    const { expr } = child

    prop.expr = expr
    prop.children = env.UNDEFINED

    // 对于有静态路径的表达式，可转为单向绑定指令，可实现精确更新视图，如下
    // <div class="{{className}}">

    if (expr[env.RAW_STATIC_KEYPATH]) {
      prop.binding = env.TRUE
    }

  },

  processAttributeEmptyChildren = function (element: Element, attr: Attribute) {

    const { name } = attr

    if (isSpecialAttr(element, attr)) {
      if (process.env.NODE_ENV === 'dev') {
        fatal(`${name} 忘了写值吧？`)
      }
    }
    // 比如 <Dog isLive>
    else if (element.isComponent) {
      attr.value = env.TRUE
    }
    // <div data-name checked>
    else {
      attr.value = string.startsWith(name, 'data-')
        ? env.EMPTY_STRING
        : name
    }

  },

  processAttributeSingleText = function (attr: Attribute, child: Text) {

    attr.value = child.text
    attr.children = env.UNDEFINED

  },

  processAttributeSingleExpression = function (attr: Attribute, child: Expression) {

    const { expr } = child

    attr.expr = expr
    attr.children = env.UNDEFINED

    // 对于有静态路径的表达式，可转为单向绑定指令，可实现精确更新视图，如下
    // <div class="{{className}}">

    if (expr[env.RAW_STATIC_KEYPATH]) {
      attr.binding = env.TRUE
    }

  },

  processDirectiveEmptyChildren = function (element: Element, directive: Directive) {

    directive.value = env.TRUE

  },

  processDirectiveSingleText = function (directive: Directive, child: Text) {

    const { text } = child

    // lazy 不需要编译表达式
    // 因为 lazy 的值必须是大于 0 的数字
    if (directive.name === config.DIRECTIVE_LAZY) {
      if (is.numeric(text)) {
        const value = toNumber(text)
        if (value > 0) {
          directive.value = value
        }
        else if (process.env.NODE_ENV === 'dev') {
          fatal(`lazy 指令的值 [${text}] 必须大于 0`)
        }
      }
      else if (process.env.NODE_ENV === 'dev') {
        fatal(`lazy 指令的值 [${text}] 必须是数字`)
      }
    }
    else {

      // 指令的值是纯文本，可以预编译表达式，提升性能
      const expr = exprCompiler.compile(text),

      // model="xx" model="this.x" 值只能是标识符或 Member
      isModel = directive.name === config.DIRECTIVE_MODEL,

      // on-click="xx" on-click="method()" 值只能是标识符或函数调用
      isEvent = directive.name === config.DIRECTIVE_EVENT

      if (expr) {

        if (process.env.NODE_ENV === 'dev') {
          // 如果指令表达式是函数调用，则只能调用方法（难道还有别的好调用的吗？）
          if (expr.type === exprNodeType.CALL) {
            const { callee } = expr as ExpressionCall
            if (callee.type !== exprNodeType.IDENTIFIER) {
              fatal('指令表达式的类型如果是函数调用，则只能调用方法')
            }
          }
          // 上面检测过方法调用，接下来事件指令只需要判断是否是标识符
          else if (isEvent && expr.type !== exprNodeType.IDENTIFIER) {
            fatal('事件指令的表达式只能是 标识符 或 函数调用')
          }

          if (isModel && !expr[env.RAW_STATIC_KEYPATH]) {
            fatal(`model 指令的值格式错误: [${expr.raw}]`)
          }
        }

        directive.expr = expr

      }
      else if (process.env.NODE_ENV === 'dev') {
        if (isModel || isEvent) {
          fatal(`${directive.name} 指令的表达式错误: [${text}]`)
        }
      }

      directive.value = text

    }

    directive.children = env.UNDEFINED

  },

  processDirectiveSingleExpression = function (directive: Directive, child: Expression) {

    if (process.env.NODE_ENV === 'dev') {
      fatal(`指令的表达式不能用插值语法`)
    }

  },

  checkCondition = function (condition: If | ElseIf | Else) {

    let currentNode: any = condition,

    prevNode: any,

    hasChildren: boolean | undefined,

    hasNext: boolean | undefined

    // 变成一维数组，方便遍历
    while (env.TRUE) {
      if (currentNode.children) {
        if (!hasNext) {
          if (currentNode.next) {
            delete currentNode.next
          }
        }
        hasChildren = hasNext = env.TRUE
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

    if (process.env.NODE_ENV === 'dev') {
      const isTemplate = element.tag === env.RAW_TEMPLATE

      if (element.slot) {
        if (!isTemplate) {
          fatal(`slot 属性只能用于 <template>`)
        }
        else if (element.key) {
          fatal(`<template> 不支持 key`)
        }
        else if (element.ref) {
          fatal(`<template> 不支持 ref`)
        }
        else if (element.attrs) {
          fatal(`<template> 不支持属性或指令`)
        }
      }
      else if (isTemplate) {
        fatal(`<template> 不写 slot 属性是几个意思？`)
      }
      else if (element.tag === env.RAW_SLOT && !element.name) {
        fatal(`<slot> 不写 name 属性是几个意思？`)
      }
    }

    // style 如果啥都没写，就默认加一个 type="text/css"
    // 因为低版本 IE 没这个属性，没法正常渲染样式
    // 如果 style 写了 attribute 那就自己保证吧
    // 因为 attrs 具有动态性，compiler 无法保证最终一定会输出 type 属性
    if (element.isStyle && array.falsy(element.attrs)) {
      element.attrs = [
        creator.createProperty(env.RAW_TYPE, config.HINT_STRING, 'text/css')
      ]
    }

  },

  bindSpecialAttr = function (element: Element, attr: Attribute) {

    const { name, value } = attr,

    // 这三个属性值要求是字符串
    isStringValueRequired = name === env.RAW_NAME || name === env.RAW_SLOT

    if (process.env.NODE_ENV === 'dev') {
      // 因为要拎出来给 element，所以不能用 if
      if (array.last(nodeStack) !== element) {
        fatal(`${name} 不能写在 if 内`)
      }
      // 对于所有特殊属性来说，空字符串是肯定不行的，没有任何意义
      if (value === env.EMPTY_STRING) {
        fatal(`${name} 的值不能是空字符串`)
      }
      else if (isStringValueRequired && string.falsy(value)) {
        fatal(`${name} 的值只能是字符串字面量`)
      }
    }

    element[name] = isStringValueRequired ? value : attr
    replaceChild(attr)

  },

  isSpecialAttr = function (element: Element, attr: Attribute): boolean {
    return helper.specialAttrs[attr.name]
      || element.tag === env.RAW_SLOT && attr.name === env.RAW_NAME
  },

  replaceChild = function (oldNode: Node, newNode?: Node) {

    let currentBranch: Branch | void = array.last(nodeStack),

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
              currentBranch.children = env.UNDEFINED
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

    const type = node.type, currentBranch: Branch = array.last(nodeStack)

    // else 系列只是 if 的递进节点，不需要加入 nodeList
    if (type === nodeType.ELSE || type === nodeType.ELSE_IF) {

      const lastNode = array.pop(ifStack)

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
          if (process.env.NODE_ENV === 'dev') {
            fatal('大哥，else 后面不能跟 else if 啊')
          }
        }
        else if (process.env.NODE_ENV === 'dev') {
          fatal('大哥，只能写一个 else 啊！！')
        }
      }
      else if (process.env.NODE_ENV === 'dev') {
        fatal('不写 if 是几个意思？？')
      }

    }
    else {

      if (currentBranch) {
        array.push(
          // 这里不能写 currentElement && !currentAttribute，举个例子
          //
          // <div id="x" {{#if}} name="xx" alt="xx" {{/if}}
          //
          // 当 name 属性结束后，条件满足，但此时已不是元素属性层级了
          currentElement && currentBranch.type === nodeType.ELEMENT
            ? currentElement.attrs || (currentElement.attrs = [])
            : currentBranch.children || (currentBranch.children = []),
          node
        )
      }
      else {
        array.push(nodeList, node)
      }

      if (type === nodeType.IF) {
        // 只要是 if 节点，并且和 element 同级，就加上 stub
        // 方便 virtual dom 进行对比
        // 这个跟 virtual dom 的实现原理密切相关，不加 stub 会有问题
        if (!currentElement) {
          (node as If).stub = env.TRUE
        }
        array.push(ifStack, node)
      }

    }



    if (node.isLeaf) {
      // 当前树枝节点如果是静态的，一旦加入了一个非静态子节点，改变当前树枝节点的 isStatic
      // 这里不处理树枝节点的进栈，因为当树枝节点出栈时，还有一次处理机会，那时它的 isStatic 已确定下来，不会再变
      if (currentBranch) {
        if (currentBranch.isStatic && !node.isStatic) {
          currentBranch.isStatic = env.FALSE
        }
        // 当前树枝节点是简单节点，一旦加入了一个复杂子节点，当前树枝节点变为复杂节点
        if (!currentBranch.isComplex && node.isComplex) {
          currentBranch.isComplex = env.TRUE
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
    text = trimBreakline(text)
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
          if (match[1] === '/') {
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
            if (process.env.NODE_ENV === 'dev') {
              if (tag === env.RAW_TEMPLATE) {
                const lastNode = array.last(nodeStack)
                if (!lastNode || !lastNode.isComponent) {
                  fatal('<template> 只能写在组件标签内')
                }
              }
            }

            const node = creator.createElement(
              tag,
              array.has(svgTagNames, tag),
              componentNamePattern.test(tag)
            )

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
          if (match[1] === '/') {
            popStack(currentElement.type, currentElement.tag)
          }

          currentElement = env.UNDEFINED
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
          if (process.env.NODE_ENV === 'dev') {
            if (match[2]) {
              fatal(`上一个属性似乎没有正常结束`)
            }
          }

          let node: Attribute | Directive | Property, name = match[1]

          if (name === config.DIRECTIVE_MODEL || name === env.RAW_TRANSITION) {
            node = creator.createDirective(
              string.camelize(name)
            )
          }
          // 这里要用 on- 判断前缀，否则 on 太容易重名了
          else if (string.startsWith(name, config.DIRECTIVE_ON + directiveSeparator)) {
            const event = slicePrefix(name, config.DIRECTIVE_ON + directiveSeparator)
            if (process.env.NODE_ENV === 'dev') {
              if (!event) {
                fatal('缺少事件名称')
              }
            }
            node = creator.createDirective(
              config.DIRECTIVE_EVENT,
              string.camelize(event)
            )
          }
          // 当一个元素绑定了多个事件时，可分别指定每个事件的 lazy
          // 当只有一个事件时，可简写成 lazy
          // <div on-click="xx" lazy-click
          else if (string.startsWith(name, config.DIRECTIVE_LAZY)) {
            let lazy = slicePrefix(name, config.DIRECTIVE_LAZY)
            if (string.startsWith(lazy, directiveSeparator)) {
              lazy = slicePrefix(lazy, directiveSeparator)
            }
            node = creator.createDirective(
              config.DIRECTIVE_LAZY,
              lazy ? string.camelize(lazy) : env.EMPTY_STRING
            )
          }
          // 这里要用 o- 判断前缀，否则 o 太容易重名了
          else if (string.startsWith(name, config.DIRECTIVE_CUSTOM + directiveSeparator)) {
            const custom = slicePrefix(name, config.DIRECTIVE_CUSTOM + directiveSeparator)
            if (process.env.NODE_ENV === 'dev') {
              if (!custom) {
                fatal('缺少自定义指令名称')
              }
            }
            node = creator.createDirective(
              config.DIRECTIVE_CUSTOM,
              string.camelize(custom)
            )
          }
          else {
            // 组件用驼峰格式
            if (currentElement.isComponent) {
              node = creator.createAttribute(
                string.camelize(name)
              )
            }
            // 原生 dom 属性
            else {

              // 把 attr 优化成 prop
              const lowerName = name.toLowerCase()

              // <slot> 或 <template> 中的属性不用识别为 property
              if (helper.specialTags[currentElement.tag]) {
                node = creator.createAttribute(name)
              }
              // 尝试识别成 property
              else if (array.has(stringProperyNames, lowerName)) {
                node = creator.createProperty(
                  attr2Prop[lowerName] || lowerName,
                  config.HINT_STRING
                )
              }
              else if (array.has(numberProperyNames, lowerName)) {
                node = creator.createProperty(
                  attr2Prop[lowerName] || lowerName,
                  config.HINT_NUMBER
                )
              }
              else if (array.has(booleanProperyNames, lowerName)) {
                node = creator.createProperty(
                  attr2Prop[lowerName] || lowerName,
                  config.HINT_BOOLEAN
                )
              }
              // 没辙，还是个 attribute
              else {
                node = creator.createAttribute(name)
              }

            }
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
          addTextChild(text)

          text += startQuote

          // attribute directive 结束了
          // 此时如果一个值都没收集到，需设置一个空字符串
          // 否则无法区分 <div a b=""> 中的 a 和 b
          if (!currentAttribute.children) {
            addChild(
              creator.createText(env.EMPTY_STRING)
            )
          }

          popStack(currentAttribute.type)
          currentAttribute = env.UNDEFINED

        }
        // 没有结束引号，整段匹配
        // 如 id="1{{x}}2" 中的 1
        else if (blockMode !== BLOCK_MODE_NONE) {
          text = content
          addTextChild(text)
        }
        else if (process.env.NODE_ENV === 'dev') {
          fatal(`${currentAttribute.name} 没有找到结束引号`)
        }

      }
      // 如果不加判断，类似 <div {{...obj}}> 这样写，会把空格当做一个属性
      // 收集文本只有两处：属性值、元素内容
      // 属性值通过上面的 if 处理过了，这里只需要处理元素内容
      else if (!currentElement) {

        // 获取 <tag 前面的字符
        match = content.match(tagPattern)

        if (match) {
          text = string.slice(content, 0, match.index)
          if (text) {
            addTextChild(
              text.replace(commentPattern, env.EMPTY_STRING)
            )
          }
        }
        else {
          text = content
          addTextChild(text)
        }

      }
      else {
        if (process.env.NODE_ENV === 'dev') {
          if (string.trim(content)) {
            fatal(`<${currentElement.tag}> 属性里不要写乱七八糟的字符`)
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
      if (string.startsWith(source, config.SYNTAX_EACH)) {
        source = slicePrefix(source, config.SYNTAX_EACH)
        const terms = source.replace(/\s+/g, env.EMPTY_STRING).split(':')
        if (terms[0]) {
          const expr = exprCompiler.compile(string.trim(terms[0]))
          if (expr) {
            if (!currentElement) {
              return creator.createEach(
                expr,
                string.trim(terms[1])
              )
            }
            else if (process.env.NODE_ENV === 'dev') {
              fatal(
                currentAttribute
                  ? `each 不能写在属性的值里`
                  : `each 不能写在属性层级`
              )
            }
          }
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 each`)
        }
      }
    },
    // {{#import name}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_IMPORT)) {
        source = slicePrefix(source, config.SYNTAX_IMPORT)
        if (source) {
          if (!currentElement) {
            return creator.createImport(source)
          }
          else if (process.env.NODE_ENV === 'dev') {
            fatal(
              currentAttribute
                ? `import 不能写在属性的值里`
                : `import 不能写在属性层级`
            )
          }
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 import`)
        }
      }
    },
    // {{#partial name}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_PARTIAL)) {
        source = slicePrefix(source, config.SYNTAX_PARTIAL)
        if (source) {
          if (!currentElement) {
            return creator.createPartial(source)
          }
          else if (process.env.NODE_ENV === 'dev') {
            fatal(
              currentAttribute
                ? `partial 不能写在属性的值里`
                : `partial 不能写在属性层级`
            )
          }
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 partial`)
        }
      }
    },
    // {{#if expr}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_IF)) {
        source = slicePrefix(source, config.SYNTAX_IF)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createIf(expr)
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 if`)
        }
      }
    },
    // {{else if expr}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_ELSE_IF)) {
        source = slicePrefix(source, config.SYNTAX_ELSE_IF)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createElseIf(expr)
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 else if`)
        }
      }
    },
    // {{else}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_ELSE)) {
        source = slicePrefix(source, config.SYNTAX_ELSE)
        if (!string.trim(source)) {
          return creator.createElse()
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`else 后面不要写乱七八糟的东西`)
        }
      }
    },
    // {{...obj}}
    function (source: string) {
      if (string.startsWith(source, config.SYNTAX_SPREAD)) {
        source = slicePrefix(source, config.SYNTAX_SPREAD)
        const expr = exprCompiler.compile(source)
        if (expr) {
          if (currentElement && currentElement.isComponent) {
            return creator.createSpread(
              expr,
              is.string(expr[env.RAW_STATIC_KEYPATH])
                ? env.TRUE
                : env.FALSE
            )
          }
          else if (process.env.NODE_ENV === 'dev') {
            fatal(`延展属性只能用于组件属性`)
          }
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 spread`)
        }
      }
    },
    // {{expr}}
    function (source: string) {
      if (!config.SYNTAX_COMMENT.test(source)) {
        source = string.trim(source)
        const expr = exprCompiler.compile(source)
        if (expr) {
          return creator.createExpression(expr, blockMode === BLOCK_MODE_SAFE)
        }
        if (process.env.NODE_ENV === 'dev') {
          fatal(`无效的 expression`)
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
            return env.FALSE
          }
        }
      )
    }
  },

  parseBlock = function (code: string) {
    if (string.charAt(code) === '/') {

      /**
       * 处理可能存在的自闭合元素，如下
       *
       * {{#if xx}}
       *    <input>
       * {{/if}}
       */
      popSelfClosingElementIfNeeded()

      const name = string.slice(code, 1)

      let type = helper.name2Type[name], isCondition: boolean | void
      if (type === nodeType.IF) {
        const node = array.pop(ifStack)
        if (node) {
          type = node.type
          isCondition = env.TRUE
        }
        else if (process.env.NODE_ENV === 'dev') {
          fatal(`if 还没开始就结束了？`)
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
            return env.FALSE
          }
        }
      )
    }
  }

  while (env.TRUE) {
    openBlockIndex = string.indexOf(content, '{{', nextIndex)
    if (openBlockIndex >= nextIndex) {

      blockMode = BLOCK_MODE_SAFE

      parseHtml(
        string.slice(content, nextIndex, openBlockIndex)
      )

      // 跳过 {{
      openBlockIndex += 2

      // {{ 后面总得有内容吧
      if (openBlockIndex < length) {
        if (string.charAt(content, openBlockIndex) === '{') {
          blockMode = BLOCK_MODE_UNSAFE
          openBlockIndex++
        }
        if (openBlockIndex < length) {
          closeBlockIndex = string.indexOf(content, '}}', openBlockIndex)
          if (closeBlockIndex >= openBlockIndex) {
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
                  fatal(`{{ 和 }}} 无法配对`)
                }
              }
              else {
                if (blockMode === BLOCK_MODE_SAFE) {
                  nextIndex = index
                }
                else {
                  fatal(`{{{ 和 }} 无法配对`)
                }
              }

              code = string.trim(
                string.slice(content, openBlockIndex, closeBlockIndex)
              )

              // 不用处理 {{ }} 和 {{{ }}} 这种空 block
              if (code) {
                parseBlock(code)
              }

            }
            else {
              // 到头了
              break
            }
          }
          else if (process.env.NODE_ENV === 'dev') {
            fatal('找不到结束定界符')
          }
        }
        else if (process.env.NODE_ENV === 'dev') {
          fatal('{{{ 后面没字符串了？')
        }
      }
      else if (process.env.NODE_ENV === 'dev') {
        fatal('{{ 后面没字符串了？')
      }

    }
    else {
      blockMode = BLOCK_MODE_NONE
      parseHtml(
        string.slice(content, nextIndex)
      )
      break
    }
  }

  if (process.env.NODE_ENV === 'dev') {
    if (nodeStack.length) {
      fatal('还有节点未出栈')
    }
  }

  return compileCache[content] = nodeList

}