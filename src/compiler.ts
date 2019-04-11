import * as config from 'yox-config'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'

import * as exprCompiler from 'yox-expression-compiler/src/compiler'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

import * as helper from './helper'
import * as creator from './creator'
import * as nodeType from './nodeType'

import If from './node/If'
import Node from './node/Node'
import Element from './node/Element'
import Attribute from './node/Attribute'

// 缓存编译模板
const compileCache = {},

// 缓存编译正则
patternCache = {},

// 分割符，即 {{ xx }} 和 {{{ xx }}}
blockPattern = /(\{?\{\{)\s*([^\}]+?)\s*(\}\}\}?)/,

// 标签
tagPattern = /<(\/)?([$a-z][-a-z0-9]*)/i,

// 属性的 name
attributePattern = /^\s*([-:\w]+)(?:=(['"]))?/,

// 首字母大写，或中间包含 -
componentNamePattern = /^[$A-Z]|-/,

// 自闭合标签
selfClosingTagPattern = /^\s*(\/)?>/,

// 支持的自闭合标签名
selfClosingTagNames = 'area,base,embed,track,source,param,input,slot,col,img,br,hr'.split(',')


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
    char.CHAR_BLANK
  )
}

export function compile(content: string) {

  let nodeList = compileCache[content]
  if (nodeList) {
    return nodeList
  }

  nodeList = []

  let nodeStack: Node[] = [],

    // 持有 if/elseif/else 节点
    ifStack: Node[] = [],

    currentElement: Element | void,

    currentAttribute: Attribute | void,

    str = content,

    startQuote: string | void,

    length: number | void,

    isSafeBlock = env.FALSE,

    match: RegExpMatchArray | void,

    reportError = function (msg: string) {
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
      const target = array.pop(nodeStack)
      if (target && target.type === type) {

        const { tag, children } = target,

        isElement = type === nodeType.ELEMENT,

        isAttribute = type === nodeType.ATTRIBUTE,

        // 是否可以收集 props 需满足以下条件
        // 1. 当前元素不是组件，因为组件的子节点要作为 slot 节点
        // 2. 当前元素不是插槽，因为后续要收集插槽的子节点
        needProps = isElement && !target.component && !target.slot,

        // 优化单个子节点
        singleChild = children && children.length === 1 && children[0]

        if (tagName && tag !== tagName) {
          reportError(`结束标签是${tagName}，开始标签却是${tag}`)
        }

        if (singleChild) {

          switch (singleChild.type) {

            case nodeType.TEXT:
              const { text } = singleChild
              // 属性的值如果是纯文本，直接获取文本值
              // 减少渲染时的遍历
              if (isAttribute) {
                target.value = text
                if (target.directive) {
                  // 指令的值如果是纯文本，可以预编译表达式，提升性能
                  target.expr = exprCompiler.compile(text)
                }
                target.children = env.UNDEFINED
              }
              else if (needProps) {
                target.props = [
                  creator.createPair(
                    'text',
                    text
                  )
                ]
                target.children = env.UNDEFINED
              }
              break

            case nodeType.EXPRESSION:
              const { expr } = singleChild
              if (currentElement && isAttribute) {
                target.expr = expr
                target.children = env.UNDEFINED

                // 对于有静态路径的表达式，可转为单向绑定指令，可实现精确更新视图，如下
                // <div class="{{className}}"> 类似的转为 <div :class="className">（其实没这个指令）
                if (expr.staticKeypath) {
                  target.directive = env.TRUE
                  target.namespace = config.DIRECTIVE_BINDING
                  target.value = expr.staticKeypath
                  target.expr = env.UNDEFINED
                }
              }
              else if (needProps) {
                target.props = [
                  creator.createPair(
                    singleChild.safe ? 'text' : 'html',
                    env.UNDEFINED,
                    expr
                  )
                ]
                target.children = env.UNDEFINED
              }
              break

          }
        }
        else if (isAttribute) {
          if (children) {
            // 不支持 on-click="1{{xx}}2" 或是 on-click="1{{#if x}}x{{else}}y{{/if}}2"
            // 1. 很难做性能优化
            // 2. 全局搜索不到事件名，不利于代码维护
            // 为了统一，所有指令不支持这样写
            if (target.directive) {
              reportError(`指令的值不能用插值语法`)
            }
          }
          // 没有值的属性
          else if (currentElement) {
            target.value = currentElement.component ? env.TRUE : target.name
          }
        }

        if (isElement) {
          if (tag === env.RAW_TEMPLATE && !target.slot) {
            reportError(`<template> 不写 slot 属性是几个意思？`)
          }
        }

        else if (isAttribute && target.name === env.RAW_SLOT && currentElement) {
          if (string.falsy(target.value)) {
            reportError(`slot 属性的值只支持字符串字面量，且不能为空字符串`)
          }
          else {
            currentElement.slot = target.value
            array.remove(currentElement.attrs, target)
          }
        }

      }
      else {
        reportError(`出栈节点类型不匹配`)
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

      const type = node.type

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
            reportError('大哥，只能写一个 else 啊！！')
          }
        }
        else {
          reportError('不写 if 是几个意思？？')
        }

      }
      else {

        const currentNode = array.last(nodeStack)

        if (currentNode) {
          array.push(
            currentElement && !currentAttribute
              ? currentNode.attrs || (currentNode.attrs = [])
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

      if (!helper.leafTypes[type]) {
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
                if (!lastNode || !lastNode.component) {
                  reportError('<template> 只能写在组件标签内')
                }
              }

              const node = creator.createElement(
                tag,
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
            let node: Attribute

            const name = match[1]
            if (helper.builtInDirectives[name]) {
              node = creator.createAttribute(
                string.camelCase(name),
                env.TRUE,
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_EVENT_PREFIX)) {
              node = creator.createAttribute(
                string.camelCase(
                  slicePrefix(name, config.DIRECTIVE_EVENT_PREFIX)
                ),
                env.TRUE,
                config.DIRECTIVE_EVENT
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
              node = creator.createAttribute(
                string.camelCase(
                  slicePrefix(name, config.DIRECTIVE_CUSTOM_PREFIX)
                ),
                env.TRUE
              )
            }
            else {
              // 组件用驼峰格式
              if (currentElement.component) {
                node = creator.createAttribute(
                  string.camelCase(name),
                  env.FALSE
                )
              }
              // 原生 html 可能带有命名空间
              else {
                const parts = name.split(':')
                node = parts.length === 1
                  ? creator.createAttribute(
                      name,
                      env.FALSE
                    )
                  : creator.createAttribute(
                      parts[1],
                      env.FALSE,
                      parts[0]
                    )
              }
            }

            addChild(node)

            // 这里先记下，下一个 handler 要匹配结束引号
            startQuote = match[2]

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
                creator.createText(char.CHAR_BLANK)
              )
            }

            popStack(currentAttribute.type)
            currentAttribute = env.UNDEFINED

          }
          // 没有结束引号，整段匹配
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

          text = match && match.index > 0
            ? string.slice(content, 0, match.index)
            : content

          addTextChild(text)

        }
        else {
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
          const terms = source.replace(/\s+/g, char.CHAR_BLANK).split(':')
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
                reportError(
                  currentAttribute
                    ? `each 不能写在属性的值里`
                    : `each 不能写在属性层级`
                )
              }
            }
          }
          reportError(`无效的 each`)
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
              reportError(
                currentAttribute
                  ? `import 不能写在属性的值里`
                  : `import 不能写在属性层级`
              )
            }
          }
          reportError(`无效的 import`)
        }
      },
      // {{#partial name}}
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_PARTIAL)) {
          source = slicePrefix(source, config.SYNTAX_PARTIAL)
          if (source) {
            return creator.createPartial(source)
          }
          reportError(`无效的 partial`)
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
          reportError(`无效的 if`)
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
          reportError(`无效的 else if`)
        }
      },
      // {{else}}
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_ELSE)) {
          source = slicePrefix(source, config.SYNTAX_ELSE)
          if (!string.trim(source)) {
            return creator.createElse()
          }
          reportError(`else 后面不要写乱七八糟的东西`)
        }
      },
      // {{...obj}}
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_SPREAD)) {
          source = slicePrefix(source, config.SYNTAX_SPREAD)
          const expr = exprCompiler.compile(source)
          if (expr) {
            if (currentElement && currentElement.component) {
              return creator.createSpread(expr)
            }
            else {
              reportError(`延展属性只能用于组件属性`)
            }
          }
          reportError(`无效的 spread`)
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
          reportError(`无效的 expression`)
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
        if (char.charAt(content) === '/') {
          const name = string.slice(content, 1)
          let type = helper.name2Type[name]
          if (type === nodeType.IF) {
            const node = array.pop(ifStack)
            if (node) {
              type = node.type
            }
            else {
              reportError(`if 还没开始就结束了？`)
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



  // 干掉 html 注释
  str = str.replace(
    /<!--[\s\S]*?-->/g,
    char.CHAR_BLANK
  )

  while (str) {
    // 匹配 {{ }}
    match = str.match(blockPattern)
    if (match) {

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
        reportError(`${match[1]} and ${match[3]} is not a pair.`)
      }

    }
    else {
      parseHtml(str)
    }
  }

  return compileCache[content] = nodeList

}