import * as config from 'yox-config'

import toNumber from 'yox-common/function/toNumber'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as exprCompiler from 'yox-expression-compiler/src/compiler'

import * as helper from './helper'
import * as creator from './creator'
import * as nodeType from './nodeType'

import If from './node/If'
import Node from './node/Node'
import Branch from './node/Branch'
import Text from './node/Text'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
import Expression from './node/Expression'

// 缓存编译模板
const compileCache = {},

// 缓存编译正则
patternCache = {},

// 指令分隔符，如 on-click 和  lazy-click
SEP_DIRECTIVE = '-',

// 分割符，即 {{ xx }} 和 {{{ xx }}}
blockPattern = /(\{?\{\{)\s*([^\}]+?)\s*(\}\}\}?)/,

// 标签
tagPattern = /<(\/)?([$a-z][-a-z0-9]*)/i,

// 属性的 name
attributePattern = /^\s*([-:\w]+)(['"])?(?:=(['"]))?/,

// 首字母大写，或中间包含 -
componentNamePattern = /^[$A-Z]|-/,

// 自闭合标签
selfClosingTagPattern = /^\s*(\/)?>/,

// 常见的自闭合标签
selfClosingTagNames = 'area,base,embed,track,source,param,input,slot,col,img,br,hr'.split(','),

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

export function compile(content: string) {

  let nodeList: Node[] = compileCache[content]
  if (nodeList) {
    return nodeList
  }

  nodeList = []

  let nodeStack: Node[] = [],

    // 持有 if/elseif/else 节点
    ifStack: Node[] = [],

    currentElement: Element | void,

    currentAttribute: Attribute | Directive | Property | void,

    // 干掉 html 注释
    str = content.replace(
      /<!--[\s\S]*?-->/g,
      env.EMPTY_STRING
    ),

    startQuote: string | void,

    length: number | void,

    isSafeBlock = env.FALSE,

    nextIsBlock = env.FALSE,

    match: RegExpMatchArray | void,

    fatal = function (msg: string) {
      logger.fatal(`Error compiling ${env.RAW_TEMPLATE}:\n${content}\n- ${msg}`)
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

        const currentNode: Branch = array.last(nodeStack)
        if (currentNode && currentNode.isStatic && !node.isStatic) {
          currentNode.isStatic = env.FALSE
        }

        const { children } = node,

        // 优化单个子节点
        singleChild = children && children.length === 1 && children[0],

        isElement = type === nodeType.ELEMENT,

        isAttribute = type === nodeType.ATTRIBUTE,

        isProperty = type === nodeType.PROPERTY,

        isDirective = type === nodeType.DIRECTIVE

        if (isElement) {
          const element = node as Element
          if (tagName && element.tag !== tagName) {
            fatal(`结束标签是${tagName}，开始标签却是${element.tag}`)
          }
        }

        // 除了 helper.specialAttrs 里指定的特殊属性，attrs 里的任何节点都不能单独拎出来赋给 element
        // 因为 attrs 可能存在 if，所以每个 attr 最终都不一定会存在
        if (singleChild) {

          switch (singleChild.type) {

            case nodeType.TEXT:
              // 属性的值如果是纯文本，直接获取文本值
              // 减少渲染时的遍历
              if (isElement) {
                processElementSingleText(node as Element, singleChild as Text)
              }
              else if (isAttribute) {
                processAttributeSingleText(node as Attribute, singleChild as Text)
              }
              else if (isProperty) {
                processPropertySingleText(node as Property, singleChild as Text)
              }
              else if (isDirective) {
                processDirectiveSingleText(node as Directive, singleChild as Text)
              }
              break

            case nodeType.EXPRESSION:
              if (isElement) {
                processElementSingleExpression(node as Element, singleChild as Expression)
              }
              else if (isAttribute) {
                processAttributeSingleExpression(node as Attribute, singleChild as Expression)
              }
              else if (isProperty) {
                processPropertySingleExpression(node as Property, singleChild as Expression)
              }
              else if (isDirective) {
                processDirectiveSingleExpression(node as Directive, singleChild as Expression)
              }
              break

          }
        }
        // 大于 1 个子节点，即有插值或 if 写法
        else if (children) {
          // 不支持 on-click="1{{xx}}2" 或是 on-click="1{{#if x}}x{{else}}y{{/if}}2"
          // 1. 很难做性能优化
          // 2. 全局搜索不到事件名，不利于代码维护
          // 为了统一，所有指令不支持这样写
          if (isDirective) {
            fatal(`指令的值不能用插值或 if 语法`)
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

        if (isElement) {
          checkSlot(node as Element)
        }
        else if (currentElement && isAttribute && isSpecialAttr(currentElement, node as Attribute)) {
          bindSpecialAttr(currentElement, node as Attribute)
        }

      }
      else {
        fatal(`出栈节点类型不匹配`)
      }
    },

    processElementSingleText = function (element: Element, child: Text) {

      // children 是否可以转换成 props 需满足以下条件
      // 1. 当前元素不是组件，因为组件的子节点要作为 slot 节点
      // 2. 当前元素不是插槽，因为后续要收集插槽的子节点
      if (!element.isComponent && !element.slot) {

        array.push(
          element.attrs || (element.attrs = []),
          creator.createProperty(
            'textContent',
            config.HINT_STRING,
            child.text
          )
        )
        element.children = env.UNDEFINED

      }

    },

    processElementSingleExpression = function (element: Element, child: Expression) {

      // children 是否可以转换成 props 需满足以下条件
      // 1. 当前元素不是组件，因为组件的子节点要作为 slot 节点
      // 2. 当前元素不是插槽，因为后续要收集插槽的子节点
      if (!element.isComponent && !element.slot) {

        array.push(
          element.attrs || (element.attrs = []),
          creator.createProperty(
            child.safe ? 'textContent' : 'innerHTML',
            config.HINT_STRING,
            env.UNDEFINED,
            child.expr
          )
        )
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

      if (isSpecialAttr(element, attr)) {
        fatal(`${attr.name} 忘了写值吧？`)
      }
      // 可能存在没收集到的布尔类型的 property
      else {
        attr.value = element.isComponent ? env.TRUE : attr.name
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
          else {
            fatal(`lazy 指令的值 [${text}] 必须大于 0`)
          }
        }
        else {
          fatal(`lazy 指令的值 [${text}] 必须是数字`)
        }
      }
      else {

        // 指令的值是纯文本，可以预编译表达式，提升性能
        const expr = exprCompiler.compile(text)
        if (expr) {
          directive.expr = expr
        }

        // model="xx" 值只能是标识符
        if (directive.name === config.DIRECTIVE_MODEL) {
          if (!expr || expr.type !== exprNodeType.IDENTIFIER) {
            fatal(`model 指令的值 [${text}] 格式错误`)
          }
        }
        else {
          directive.value = text
        }

      }

      directive.children = env.UNDEFINED

    },

    processDirectiveSingleExpression = function (directive: Directive, child: Expression) {

      directive.expr = child.expr
      directive.children = env.UNDEFINED

    },

    checkSlot = function (element: Element) {

      if (element.slot) {
        if (element.tag !== env.RAW_TEMPLATE) {
          fatal(`slot 属性只能用于 <template>`)
        }
      }
      else if (element.tag === env.RAW_TEMPLATE) {
        fatal(`<template> 不写 slot 属性是几个意思？`)
      }

    },

    bindSpecialAttr = function (element: Element, attr: Attribute) {

      const { name, value } = attr

      // 因为要拎出来给 element，所以不能用 if
      if (array.last(nodeStack) !== element) {
        fatal(`${name} 不能写在 if 内`)
      }

      // 这三个属性值要求是字符串
      const isStringValueRequired = name === env.RAW_NAME || name === env.RAW_SLOT || name === env.RAW_TRANSITION

      // 对于所有特殊属性来说，空字符串是肯定不行的，没有任何意义
      if (value === env.EMPTY_STRING) {
        fatal(`${name} 的值不能是空字符串`)
      }
      else if (isStringValueRequired && string.falsy(value)) {
        fatal(`${name} 的值只能是字符串字面量`)
      }

      element[name] = isStringValueRequired ? value : attr
      replaceChild(attr)

    },

    isSpecialAttr = function (element: Element, attr: Attribute): boolean {
      return helper.specialAttrs[attr.name]
        || element.tag === env.RAW_SLOT && attr.name === env.RAW_NAME
    },

    replaceChild = function (oldNode: Node, newNode?: Node) {

      const currentNode = array.last(nodeStack),

      isAttr = currentElement && currentNode.type === nodeType.ELEMENT,

      nodeList = isAttr ? currentNode.attrs : currentNode.children,

      index = array.indexOf(nodeList, oldNode)

      if (index >= 0) {
        if (newNode) {
          nodeList[index] = newNode
        }
        else {
          nodeList.splice(index, 1)
          if (!nodeList.length) {
            if (isAttr) {
              currentNode.attrs = env.UNDEFINED
            }
            else {
              currentNode.children = env.UNDEFINED
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

      const type = node.type, currentNode: Branch = array.last(nodeStack)

      // else 系列只是 if 的递进节点，不需要加入 nodeList
      if (helper.elseTypes[type]) {

        const lastNode = array.pop(ifStack)

        if (lastNode) {
          // lastNode 只能是 if 或 else if 节点
          if (helper.ifTypes[lastNode.type]) {
            lastNode.next = node
            popStack(lastNode.type)
            array.push(ifStack, node)
          }
          else {
            fatal('大哥，只能写一个 else 啊！！')
          }
        }
        else {
          fatal('不写 if 是几个意思？？')
        }

      }
      else {

        if (currentNode) {
          array.push(
            // 这里不能写 currentElement && !currentAttribute，举个例子
            //
            // <div id="x" {{#if}} name="xx" alt="xx" {{/if}}
            //
            // 当 name 属性结束后，条件满足，但此时已不是元素属性层级了
            currentElement && currentNode.type === nodeType.ELEMENT
              ? currentElement.attrs || (currentElement.attrs = [])
              : currentNode.children || (currentNode.children = []),
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

      if (helper.leafTypes[type]) {
        if (currentNode && currentNode.isStatic && !node.isStatic) {
          currentNode.isStatic = env.FALSE
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
              if (tag === env.RAW_TEMPLATE) {
                const lastNode = array.last(nodeStack)
                if (!lastNode || !lastNode.isComponent) {
                  fatal('<template> 只能写在组件标签内')
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
            if (match[2]) {
              fatal('上一个属性似乎没有正常结束')
            }

            let node: Attribute | Directive | Property, name = match[1]

            if (name === config.DIRECTIVE_MODEL) {
              node = creator.createDirective(
                string.camelCase(name)
              )
            }
            // 这里要用 on- 判断前缀，否则 on 太容易重名了
            else if (string.startsWith(name, config.DIRECTIVE_ON + SEP_DIRECTIVE)) {
              const event = slicePrefix(name, config.DIRECTIVE_ON + SEP_DIRECTIVE)
              if (!event) {
                fatal('缺少事件名称')
              }
              node = creator.createDirective(
                config.DIRECTIVE_EVENT,
                string.camelCase(event)
              )
            }
            // 当一个元素绑定了多个事件时，可分别指定每个事件的 lazy
            // 当只有一个事件时，可简写成 lazy
            // <div on-click="xx" lazy-click
            else if (string.startsWith(name, config.DIRECTIVE_LAZY)) {
              let lazy = slicePrefix(name, config.DIRECTIVE_LAZY)
              if (string.startsWith(lazy, SEP_DIRECTIVE)) {
                lazy = slicePrefix(lazy, SEP_DIRECTIVE)
              }
              node = creator.createDirective(
                config.DIRECTIVE_LAZY,
                lazy ? string.camelCase(lazy) : env.UNDEFINED
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
              const custom = slicePrefix(name, config.DIRECTIVE_CUSTOM_PREFIX)
              if (!custom) {
                fatal('缺少自定义指令名称')
              }
              node = creator.createDirective(
                string.camelCase(custom)
              )
            }
            else {
              // 组件用驼峰格式
              if (currentElement.isComponent) {
                node = creator.createAttribute(
                  string.camelCase(name)
                )
              }
              // 原生 html 可能带有命名空间
              else {
                const parts = name.split(':')

                if (parts.length === 1) {

                  // 把 attr 优化成 prop
                  const lowerName = name.toLowerCase()

                  if (array.has(stringProperyNames, lowerName)) {
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
                  else {
                    node = creator.createAttribute(name)
                  }

                }
                else {
                  node = creator.createAttribute(parts[1], parts[0])
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

        let text: string | void, match: RegExpMatchArray | void

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
          else if (nextIsBlock) {
            text = content
            addTextChild(text)
          }
          else {
            fatal(`${currentAttribute.name} 没有找到结束引号`)
          }

        }
        // 如果不加判断，类似 <div {{...obj}}> 这样写，会把空格当做一个属性
        // 收集文本只有两处：属性值、元素内容
        // 属性值通过上面的 if 处理过了，这里只需要处理元素内容
        else if (!currentElement) {

          // 获取 <tag 前面的字符
          match = content.match(tagPattern)

          text = match && match.index > 0
            ? string.slice(content, 0, match.index)
            : content

          addTextChild(text)

        }
        else {
          if (string.trim(content)) {
            fatal(`<${currentElement.tag}> 属性里不要写乱七八糟的字符`)
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
              else {
                fatal(
                  currentAttribute
                    ? `each 不能写在属性的值里`
                    : `each 不能写在属性层级`
                )
              }
            }
          }
          fatal(`无效的 each`)
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
            else {
              fatal(
                currentAttribute
                  ? `import 不能写在属性的值里`
                  : `import 不能写在属性层级`
              )
            }
          }
          fatal(`无效的 import`)
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
            else {
              fatal(
                currentAttribute
                  ? `partial 不能写在属性的值里`
                  : `partial 不能写在属性层级`
              )
            }
          }
          fatal(`无效的 partial`)
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
          fatal(`无效的 if`)
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
          fatal(`无效的 else if`)
        }
      },
      // {{else}}
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_ELSE)) {
          source = slicePrefix(source, config.SYNTAX_ELSE)
          if (!string.trim(source)) {
            return creator.createElse()
          }
          fatal(`else 后面不要写乱七八糟的东西`)
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
            else {
              fatal(`延展属性只能用于组件属性`)
            }
          }
          fatal(`无效的 spread`)
        }
      },
      // {{expr}}
      function (source: string) {
        if (!config.SYNTAX_COMMENT.test(source)) {
          source = string.trim(source)
          const expr = exprCompiler.compile(source)
          if (expr) {
            return creator.createExpression(expr, isSafeBlock)
          }
          fatal(`无效的 expression`)
        }
      },
    ],

    parseHtml = function (content: string) {
      let tpl = content
      while (tpl) {
        array.each(
          htmlParsers,
          function (parse) {
            const match = parse(tpl)
            if (match) {
              tpl = string.slice(tpl, match.length)
              return env.FALSE
            }
          }
        )
      }
      str = string.slice(str, content.length)
    },

    parseBlock = function (content: string, all: string) {
      if (content) {
        // 结束当前 block
        // 正则会去掉 {{ xx }} 里面两侧的空白符，因此如果有 /，一定是第一个字符
        if (string.charAt(content) === '/') {
          const name = string.slice(content, 1)
          let type = helper.name2Type[name]
          if (type === nodeType.IF) {
            const node = array.pop(ifStack)
            if (node) {
              type = node.type
            }
            else {
              fatal(`if 还没开始就结束了？`)
            }
          }
          popStack(type)
        }
        else {
          // 开始下一个 block 或表达式
          array.each(
            blockParsers,
            function (parse) {
              const node = parse(content)
              if (node) {
                addChild(node)
                return env.FALSE
              }
            }
          )
        }
      }
      str = string.slice(str, all.length)
    }

  while (str) {
    // 匹配 {{ }}
    match = str.match(blockPattern)
    if (match) {

      nextIsBlock = env.TRUE

      // 裁剪开头到 {{ 之间的模板内容
      if (match.index > 0) {
        parseHtml(
          string.slice(str, 0, match.index)
        )
      }

      // 获取开始分隔符的长度，用于判断是否是安全输出
      length = match[1].length

      // 避免手误写成 {{{ name }} 或 {{ name }}}
      if (length === match[3].length) {
        isSafeBlock = length === 2
        parseBlock(match[2], match[0])
      }
      else {
        fatal(`${match[1]} and ${match[3]} is not a pair.`)
      }

    }
    else {
      nextIsBlock = env.FALSE
      parseHtml(str)
    }
  }

  return compileCache[content] = nodeList

}