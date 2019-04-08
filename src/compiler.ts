import * as config from 'yox-config'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'

import * as exprCompiler from 'yox-expression-compiler/src/compiler'

import * as helper from './helper'
import * as creator from './creator'
import * as nodeType from './nodeType'

import Node from './node/Node'
import Text from './node/Text'

// 缓存编译结果
const compileCache = {},

// 分割符，即 {{ xx }} 和 {{{ xx }}}
delimiterPattern = /(\{?\{\{)\s*([^\}]+?)\s*(\}\}\}?)/,

// 标签
tagPattern = /<(\/)?([$a-z][-a-z0-9]*)/i,

// 属性 key value
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
 * 是否是纯粹的换行
 */
function isBreakline(content: string): boolean {

  let hasBreakline = env.FALSE

  // 为了避免外部 polyfill 实现的 trim 不能干掉换行符，这里先把换行符去掉
  content.replace(
    /\n\r?/,
    function ($0) {
      hasBreakline = env.TRUE
      return char.CHAR_BLANK
    }
  )

  return hasBreakline
    ? !string.trim(content)
    : env.FALSE

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

const textProp = env.win && env.win.SVGElement ? 'textContent' : 'innerText'


const delimiterParsers = [
  // #each
  function (source: string, all: string) {
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
      reportError(`${RAW_INVALID} each: ${all}`)
    }
  },
  function (source: string, all: string) {
    if (string.startsWith(source, config.SYNTAX_IMPORT)) {
      source = slicePrefix(source, config.SYNTAX_IMPORT)
      return source
        ? creator.createImport(source)
        : reportError(`${RAW_INVALID} import: ${all}`)
    }
  },
  function (source: string, all: string) {
    if (string.startsWith(source, config.SYNTAX_PARTIAL)) {
      source = slicePrefix(source, config.SYNTAX_PARTIAL)
      return source
        ? creator.createPartial(source)
        : reportError(`${RAW_INVALID} partial: ${all}`)
    }
  },
  function (source: string, all: string) {
    if (string.startsWith(source, config.SYNTAX_IF)) {
      source = slicePrefix(source, config.SYNTAX_IF)
      const expr = exprCompiler.compile(source)
      if (expr) {
        return creator.createIf(expr)
      }
      reportError(`${RAW_INVALID} if: ${all}`)
    }
  },
  function (source: string, all: string) {
    if (string.startsWith(source, config.SYNTAX_ELSE_IF)) {
      source = slicePrefix(source, config.SYNTAX_ELSE_IF)
      const expr = exprCompiler.compile(source)
      if (expr) {
        return creator.createElseIf(expr)
      }
      reportError(`${RAW_INVALID} else if: ${all}`)
    }
  },
  function (source: string) {
    if (string.startsWith(source, config.SYNTAX_ELSE)) {
      return creator.createElse()
    }
  },
  function (source: string, all: string) {
    if (string.startsWith(source, config.SYNTAX_SPREAD)) {
      source = slicePrefix(source, config.SYNTAX_SPREAD)
      const expr = exprCompiler.compile(source)
      if (expr) {
        return creator.createSpread(expr)
      }
      reportError(`${RAW_INVALID} spread: ${all}`)
    }
  },
  function (source: string, all: string) {
    if (!config.SYNTAX_COMMENT.test(source)) {
      source = string.trim(source)
      const expr = exprCompiler.compile(source)
      if (expr) {
        return creator.createExpression(expr, !string.endsWith(all, '}}}'))
      }
      reportError(`${RAW_INVALID} expression: ${all}`)
    }
  },
]

export function compile(content: string) {

  let nodeList = compileCache[content]
  if (nodeList) {
    return nodeList
  }

  nodeList = []

  let nodeStack = [], ifStack = [], htmlStack = [], index = 0, currentQuote,

    reportError = function (msg) {
      logger.fatal(`Error compiling ${env.RAW_TEMPLATE}:${char.CHAR_BREAKLINE}${content}${char.CHAR_BREAKLINE}- ${msg}`)
    },

    popSelfClosingElementIfNeeded = function (popingTagName) {
      let lastNode = array.last(nodeStack)
      if (lastNode
        && (
          lastNode.type === nodeType.ELEMENT && lastNode.tag !== popingTagName
          || lastNode.type === nodeType.COMPONENT && lastNode.name !== popingTagName
        )
        && array.has(selfClosingTagNames, lastNode[env.RAW_TAG])
      ) {
        popStack(
          lastNode.type,
          lastNode[env.RAW_TAG]
        )
      }
    },

    popStack = function (type: number, expectedTagName?: string) {

      /**
       * <div>
       *    <input>
       * </div>
       */
      if (expectedTagName) {
        popSelfClosingElementIfNeeded(expectedTagName)
      }

      let target

      array.each(
        nodeStack,
        function (node, i) {
          if (node.type === type) {
            target = nodeStack.splice(i, 1)[0]
            return env.FALSE
          }
        },
        env.TRUE
      )

      if (target) {

        let { tag, name, divider, children, component } = target
        if (type === nodeType.ELEMENT && expectedTagName && tag !== expectedTagName) {
          reportError(`end ${env.RAW_TAG} expected </${tag}> to be </${expectedTagName}>.`)
        }

        // ==========================================
        // 以下是性能优化的逻辑
        // ==========================================

        // 如果 children 没实际的数据，删掉它
        // 避免在渲染阶段增加计算量
        if (children && !children.length) {
          children = env.NULL
          delete target.children
        }

        if (!children) {
          return
        }

        if (type === nodeType.ELEMENT) {
          // 优化只有一个子节点的情况
          if (!component
            && tag !== env.RAW_TEMPLATE
            && children.length - divider === 1
          ) {

            let singleChild = array.last(children)

            // 子节点是纯文本
            if (singleChild.type === nodeType.TEXT) {
              target.props = [
                {
                  name: textProp,
                  value: singleChild[env.RAW_TEXT],
                }
              ]
              array.pop(children)
            }
            else if (singleChild.type === nodeType.EXPRESSION) {
              let props = []
              if (singleChild.safe === env.FALSE) {
                array.push(
                  props,
                  {
                    name: 'innerHTML',
                    value: singleChild[env.RAW_EXPR],
                  }
                )
              }
              else {
                array.push(
                  props,
                  {
                    name: textProp,
                    value: singleChild[env.RAW_EXPR],
                  }
                )
              }
              target.props = props
              array.pop(children)
            }

            if (!children.length) {
              delete target.children
            }

          }
        }
        else {

          if (type === nodeType.ATTRIBUTE) {
            // <div key="xx">
            // <div ref="xx">
            // <div transition="xx">
            // <slot name="xx">
            // <template slot="xx">
            let element = array.last(htmlStack)
            if (name === env.RAW_KEY
              || name === env.RAW_REF
              || name === 'transition'
              || (element[env.RAW_TAG] === env.RAW_TEMPLATE && name === env.RAW_SLOT)
              || (element[env.RAW_TAG] === env.RAW_SLOT && name === env.RAW_NAME)
            ) {
              // 把数据从属性中提出来，减少渲染时的遍历
              array.remove(element.children, target)
              if (!element.children.length) {
                delete element.children
              }
              if (children.length) {
                element[name] = children
              }
              return
            }
          }

          let singleChild = children.length === 1 && children[0]
          if (singleChild) {
            if (singleChild.type === nodeType.TEXT) {
              // 指令的值如果是纯文本，可以预编译表达式，提升性能
              let text = singleChild[env.RAW_TEXT]
              if (type === nodeType.DIRECTIVE) {
                target[env.RAW_EXPR] = exprCompiler.compile(text)
                target[env.RAW_VALUE] = text
                delete target.children
              }
              // 属性的值如果是纯文本，直接获取文本值
              // 减少渲染时的遍历
              else if (type === nodeType.ATTRIBUTE) {
                target[env.RAW_VALUE] = text
                delete target.children
              }
            }
            // <div class="{{className}}">
            // 把 Attribute 转成 单向绑定 指令，可实现精确更新视图
            else if (type === nodeType.ATTRIBUTE
              && singleChild.type === nodeType.EXPRESSION
            ) {
              target[env.RAW_EXPR] = singleChild[env.RAW_EXPR]
              delete target.children
            }
          }
        }
      }
      else {
        reportError(`{{/${helper.type2Name[type]}}} is not a pair.`)
      }

    },

    addChild = function (node: Node) {

      const type = node.type

      if (type === nodeType.TEXT) {
        let text = (node as Text).text
        if (isBreakline(text)
          || !(text = trimBreakline(text))
        ) {
          return
        }
        node[env.RAW_TEXT] = text
      }

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
      if (!htmlStack.length) {
        popSelfClosingElementIfNeeded()
      }

      if (helper.elseTypes[type]) {
        let ifNode = array.pop(ifStack)
        ifNode.next = node
        popStack(ifNode.type)
        array.push(ifStack, node)
        array.push(nodeStack, node)
        return
      }

      let prevNode, currentNode = array.last(nodeStack)
      if (currentNode) {
        let children = currentNode.children, divider = currentNode.divider
        if (children) {
          if (children.length !== divider) {
            prevNode = children[children.length - 1]
          }
        }
        else {
          children = currentNode.children = []
        }
        array.push(children, node)
      }
      else {
        prevNode = array.last(nodeList)
        array.push(nodeList, node)
      }

      if (helper.ifTypes[type]) {
        // 只要是 if 节点，并且处于 element 层级，就加 stump
        // 方便 virtual dom 进行对比
        if (!htmlStack.length) {
          node.stump = env.TRUE
        }
        array.push(ifStack, node)
      }
      else if (helper.htmlTypes[type]) {
        array.push(htmlStack, node)
      }

      if (!helper.leafTypes[type]) {
        array.push(nodeStack, node)
      }

    },

    htmlParsers = [
      function (content: string): string | void {
        if (!htmlStack.length) {
          const match = content.match(tagPattern)
          // 必须以 <tag 开头才能继续
          if (match && !match.index) {
            let tagName = match[2]
            if (match[1] === char.CHAR_SLASH) {
              popStack(
                nodeType.ELEMENT,
                tagName
              )
            }
            else {
              addChild(
                creator.createElement(
                  tagName,
                  componentNamePattern.test(tagName)
                )
              )
            }
            return match[0]
          }
        }
      },
      // 自闭合元素
      function (content: string): string | void {
        const match = content.match(selfClosingTagPattern)
        if (match) {
          // 当前在 element/component 层级
          if (htmlStack.length === 1) {
            const element = array.last(htmlStack)
            element.divider = element.children ? element.children.length : 0
            if (match[1] === char.CHAR_SLASH) {
              popStack(
                element.type
              )
            }
            array.pop(htmlStack)
          }
          return match[0]
        }
      },
      // 处理 attribute property directive 的 name 部分
      function (content: string): string | void {
        // 当前在 element/component 层级
        if (htmlStack.length === 1) {
          const match = content.match(attributePattern)
          if (match) {
            let name = match[1]
            if (helper.builtInDirectives[name]) {
              addChild(
                creator.createDirective(
                  string.camelCase(name),
                  char.CHAR_BLANK
                )
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_EVENT_PREFIX)) {
              name = slicePrefix(name, config.DIRECTIVE_EVENT_PREFIX)
              addChild(
                creator.createDirective(
                  config.DIRECTIVE_EVENT,
                  string.camelCase(name)
                )
              )
            }
            else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
              name = string.slice(name, config.DIRECTIVE_CUSTOM_PREFIX.length)
              addChild(
                creator.createDirective(
                  string.camelCase(name),
                  char.CHAR_BLANK
                )
              )
            }
            else {
              addChild(
                creator.createAttribute(
                  htmlStack[0][env.RAW_COMPONENT]
                    ? string.camelCase(name)
                    : name
                )
              )
            }
            currentQuote = match[2]
            if (!currentQuote) {
              popStack(
                array.pop(htmlStack).type
              )
            }
            return match[0]
          }
        }
      },
      function (content: string): string | void {
        // 处理 attribute property directive 的 value 部分
        if (htmlStack.length === 2) {
          let index = 0, currentChar, closed
          while (currentChar = char.charAt(content, index)) {
            if (currentChar === currentQuote) {
              closed = env.TRUE
              break
            }
            index++
          }
          let text = char.CHAR_BLANK
          if (index) {
            text = string.slice(content, 0, index)
            addChild(
              creator.createText(text)
            )
          }
          if (closed) {
            text += currentQuote
            closed = array.pop(htmlStack)
            if (!closed.children) {
              closed[env.RAW_VALUE] = char.CHAR_BLANK
            }
            popStack(closed.type)
          }
          return text
        }
        else {
          // 跳过 <tag 前面的空白符
          let match = content.match(tagPattern)
          if (match && match.index) {
            content = string.slice(content, 0, match.index)
          }
          // 属性级别的空字符串是没有意义的
          // 比如 <div      class="xx">
          if (htmlStack.length !== 1
            || string.trim(content)
          ) {
            addChild(
              creator.createText(content)
            )
          }
          return content
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
        if (char.codeAt(content) === char.CODE_SLASH) {
          const name = string.slice(content, 1)
          let type = helper.name2Type[name]
          if (helper.ifTypes[type]) {
            const node = array.pop(ifStack)
            if (node) {
              type = node.type
            }
            else {
              reportError(`if is not begined.`)
            }
          }
          popStack(type)
        }
        else {
          // 开始下一个 block 或表达式
          array.each(
            delimiterParsers,
            function (parse) {
              const node = parse(content, all)
              if (node) {
                addChild(node)
                return env.FALSE
              }
            }
          )
        }
      }
      str = string.slice(str, all.length)
    },

    str = content,

    match: RegExpMatchArray | void

  // 干掉 html 注释
  str = str.replace(
    /<!--[\s\S]*?-->/g,
    char.CHAR_BLANK
  )

  while (str) {
    // 匹配 {{ }}
    match = str.match(delimiterPattern)
    if (match) {
      if (match.index) {
        parseHtml(
          string.slice(str, 0, match.index)
        )
      }
      // 避免手误写成 {{{ name }} 或 {{ name }}}
      if (match[1].length === match[3].length) {
        index += match[1].length
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