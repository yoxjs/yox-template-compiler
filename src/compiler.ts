import * as config from 'yox-config'

import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'

import * as exprCompiler from 'yox-expression-compiler/src/compiler'

import * as helper from './helper'
import * as creator from './creator'
import * as nodeType from './nodeType'

import Node from './node/Node'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import If from './node/If'
import ElseIf from './node/ElseIf'

// 缓存编译结果
const compileCache = {},

// 分割符，即 {{ xx }} 和 {{{ xx }}}
delimiterPattern = /(\{?\{\{)\s*([^\}]+?)\s*(\}\}\}?)/,

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
 * @param content
 * @return
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

    currentAttribute: Attribute | Directive | void,

    str = content,

    index = 0,

    startQuote: string | void,

    length: number | void,

    isSafeBlock = env.FALSE,

    match: RegExpMatchArray | void,

    reportError = function (msg: string) {
      logger.fatal(`Error compiling ${env.RAW_TEMPLATE}:${char.CHAR_BREAKLINE}${content}${char.CHAR_BREAKLINE}- ${msg}`)
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
        popStack(lastNode.type)
      }
    },

    popStack = function (type: number) {
      const target = array.pop(nodeStack)
      if (!target || target.type !== type) {
        reportError(`{{/${helper.type2Name[type]}}} is not a pair.`)
      }
    },

    addChild = function (node: any) {

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
            currentNode.children || (currentNode.children = []),
            node
          )
        }
        else {
          array.push(nodeList, node)
        }

        if (type === nodeType.IF) {
          // 只要是 if 节点，并且和 element 同级，就加上 stump
          // 方便 virtual dom 进行对比
          // 这个跟 virtual dom 的实现原理密切相关，不加 stump 会有问题
          if (!currentElement) {
            node.stump = env.TRUE
          }
          array.push(ifStack, node)
        }

      }

      if (!helper.leafTypes[type]) {
        array.push(nodeStack, node)
      }

    },

    addTextChild = function (text: string) {
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
            if (match[1] === char.CHAR_SLASH) {
              /**
               * 处理可能存在的自闭合元素，如下
               *
               * <div>
               *    <input>
               * </div>
               */
              popSelfClosingElementIfNeeded(tag)
              popStack(nodeType.ELEMENT)
            }
            else {
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
            if (match[1] === char.CHAR_SLASH) {
              popStack(currentElement.type)
            }

            currentElement.divider = currentElement.children ? currentElement.children.length : 0
            currentElement = env.UNDEFINED
          }
          // 处理结束标签的 >
          return match[0]
        }
      },
      // 处理 attribute property directive 的 name 部分
      function (content: string): string | void {
        // 当前在 element 层级
        if (currentElement && !currentAttribute) {
          const match = content.match(attributePattern)
          if (match) {
            let node: Attribute | Directive

            const name = match[1]
            if (helper.builtInDirectives[name]) {
              node = creator.createDirective(
                string.camelCase(name)
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_EVENT_PREFIX)) {
              node = creator.createDirective(
                config.DIRECTIVE_EVENT,
                string.camelCase(
                  slicePrefix(name, config.DIRECTIVE_EVENT_PREFIX)
                )
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
              node = creator.createDirective(
                string.camelCase(
                  slicePrefix(name, config.DIRECTIVE_CUSTOM_PREFIX)
                )
              )
            }
            else {
              // 组件用驼峰格式
              if (currentElement.component) {
                node = creator.createAttribute(
                  string.camelCase(name)
                )
              }
              // 原生 html 可能带有命名空间
              else {
                const parts = name.split(char.CHAR_COLON)
                node = parts.length === 1
                  ? creator.createAttribute(name)
                  : creator.createAttribute(
                      parts[1],
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
        // 处理 attribute property directive 的 value 部分
        if (currentAttribute) {
          let index = 0, currentChar: string, closed = env.FALSE
          while (currentChar = char.charAt(content, index)) {
            if (currentChar === startQuote) {
              closed = env.TRUE
              break
            }
            index++
          }
          let text = char.CHAR_BLANK
          if (index > 0) {
            text = string.slice(content, 0, index)
            addTextChild(text)
          }
          if (closed) {
            text += startQuote
            if (!currentAttribute.children) {
              // 至少得有个值，不然就变成布尔类型的属性了
              addChild(
                creator.createText(char.CHAR_BLANK)
              )
            }
            popStack(currentAttribute.type)
            currentAttribute = env.UNDEFINED
          }
          return text
        }
        else {
          // 获取 <tag 前面的字符
          const match = content.match(tagPattern)
          if (match && match.index > 0) {
            content = string.slice(content, 0, match.index)
          }
          // 元素内容，如 <div>xxx</div> 中的 xxx
          addTextChild(content)
          return content
        }
      },
    ],

    delimiterParsers = [
      // #each
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_EACH)) {
          source = slicePrefix(source, config.SYNTAX_EACH)
          const terms = source.replace(/\s+/g, char.CHAR_BLANK).split(char.CHAR_COLON)
          if (terms[0]) {
            const expr = exprCompiler.compile(string.trim(terms[0]))
            if (expr) {
              return creator.createEach(
                expr,
                string.trim(terms[1])
              )
            }
          }
          reportError(`无效的 each`)
        }
      },
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_IMPORT)) {
          source = slicePrefix(source, config.SYNTAX_IMPORT)
          if (source) {
            return creator.createImport(source)
          }
          reportError(`无效的 import`)
        }
      },
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_PARTIAL)) {
          source = slicePrefix(source, config.SYNTAX_PARTIAL)
          if (source) {
            return creator.createPartial(source)
          }
          reportError(`无效的 partial`)
        }
      },
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
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_ELSE)) {
          source = slicePrefix(source, config.SYNTAX_ELSE)
          if (!string.trim(source)) {
            return creator.createElse()
          }
          reportError(`else 后面不要写乱七八糟的东西`)
        }
      },
      function (source: string) {
        if (string.startsWith(source, config.SYNTAX_SPREAD)) {
          source = slicePrefix(source, config.SYNTAX_SPREAD)
          const expr = exprCompiler.compile(source)
          if (expr) {
            return creator.createSpread(expr)
          }
          reportError(`无效的 spread`)
        }
      },
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
              index += match.length
              return env.FALSE
            }
          }
        )
      }
      str = string.slice(str, content.length)
    },

    parseDelimiter = function (content: string, all: string) {
      if (content) {
        // 结束当前 block
        // 正则会去掉 {{ xx }} 里面两侧的空白符，因此如果有 /，一定是第一个字符
        if (char.charAt(content) === char.CHAR_SLASH) {
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
            delimiterParsers,
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
    match = str.match(delimiterPattern)
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
        index += length
        isSafeBlock = length === 2
        parseDelimiter(match[2], match[0])
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