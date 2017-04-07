
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'

import compileExpression from 'yox-expression-compiler/compile'

import * as helper from './src/helper'
import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

import Attribute from './src/node/Attribute'
import Directive from './src/node/Directive'
import Each from './src/node/Each'
import Element from './src/node/Element'
import Else from './src/node/Else'
import ElseIf from './src/node/ElseIf'
import Expression from './src/node/Expression'
import If from './src/node/If'
import Import from './src/node/Import'
import Partial from './src/node/Partial'
import Spread from './src/node/Spread'
import Text from './src/node/Text'

const delimiterPattern = /\{?\{\{\s*([^\}]+?)\s*\}\}\}?/
const openingTagPattern = /<(\/)?([a-z][-a-z0-9]*)/i
const closingTagPattern = /^\s*(\/)?>/
const attributePattern = /^\s*([-:\w]+)(?:=(['"]))?/
const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /source|param|input|img|br/

// 缓存编译结果
let compileCache = { }

/**
 * 截取前缀之后的字符串
 *
 * @param {string} str
 * @param {string} prefix
 * @return {string}
 */
function slicePrefix(str, prefix) {
  return string.trim(string.slice(str, prefix.length))
}

/**
 * 是否是纯粹的换行
 *
 * @param {string} content
 * @return {boolean}
 */
function isBreakline(content) {
  return string.has(content, char.CHAR_BREAKLINE)
    && !string.trim(content)
}

/**
 * trim 文本开始和结束位置的换行符
 *
 * @param {string} content
 * @return {string}
 */
function trimBreakline(content) {
  return content.replace(
    /^[ \t]*\n|\n[ \t]*$/g,
    char.CHAR_BLANK
  )
}

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} content
 * @return {Array}
 */
export default function compile(content) {

  let result = compileCache[ content ]
  if (result) {
    return result
  }

  let nodeList = [ ], nodeStack = [ ], ifStack = [ ], htmlStack = [ ], currentQuote

  let throwError = function (msg, showPosition) {
    if (showPosition) {
      let line = 0, col = 0, index = 0, pos = str.length
      array.each(
        content.split(char.CHAR_BREAKLINE),
        function (lineStr) {
          line++
          col = 0

          let { length } = lineStr
          if (pos >= index && pos <= (index + length)) {
            col = pos - index
            return env.FALSE
          }

          index += length
        }
      )
      msg += `, at line ${line}, col ${col}.`
    }
    else {
      msg += char.CHAR_DOT
    }
    logger.fatal(`${msg}${char.CHAR_BREAKLINE}${content}`)
  }

  let popStack = function (type) {

    let index, target

    array.each(
      nodeStack,
      function (node, i) {
        if (node.type === type) {
          index = i
          target = nodeStack.splice(i, 1)[ 0 ]
          return env.FALSE
        }
      },
      env.TRUE
    )

  }

  let addChild = function (node) {

    let { type, content } = node

    if (type === nodeType.TEXT) {
      if (isBreakline(content)
        || !(content = trimBreakline(content))
      ) {
        return
      }
      node.content = content
    }

    let currentNode = array.last(nodeStack)
    if (currentNode) {
      if (htmlStack.length === 1 && currentNode.addAttr) {
        currentNode.addAttr(node)
      }
      else {
        currentNode.addChild(node)
      }
    }
    else {
      array.push(nodeList, node)
    }

    if (!helper.leafTypes[ type ]) {
      array.push(nodeStack, node)
      if (helper.htmlTypes[ type ]) {
        array.push(htmlStack, node)
      }
      else if (helper.ifTypes[ type ]) {
        array.push(ifStack, node)
      }
    }

  }

  const htmlParsers = [
    function (content) {
      if (!htmlStack.length) {
        let match = content.match(openingTagPattern)
        // 必须以 <tag 开头才能继续
        if (match && !match.index) {
          let tagName = match[ 2 ]
          if (match[ 1 ] === '/') {
            popStack(
              nodeType.ELEMENT
            )
          }
          else {
            addChild(
              new Element(
                tagName,
                componentNamePattern.test(tagName)
              )
            )
          }
          return match[ 0 ]
        }
      }
    },
    function (content) {
      let match = content.match(closingTagPattern)
      if (match) {
        if (htmlStack.length === 1) {
          if (match[ 1 ] === '/'
            || selfClosingTagNamePattern.test(htmlStack[ 0 ].name)
          ) {
            popStack(
              nodeType.ELEMENT
            )
          }
          array.pop(htmlStack)
        }
        return match[ 0 ]
      }
    },
    function (content) {
      if (htmlStack.length === 1) {
        let match = content.match(attributePattern)
        if (match) {
          let name = match[ 1 ]
          if (helper.builtInDirectives[ name ]) {
            addChild(
              new Directive(
                string.camelCase(name)
              )
            )
          }
          else {
            if (string.startsWith(name, syntax.DIRECTIVE_EVENT_PREFIX)) {
              name = string.slice(name, syntax.DIRECTIVE_EVENT_PREFIX.length)
              addChild(
                new Directive(
                  'event',
                  string.camelCase(name)
                )
              )
            }
            else if (string.startsWith(name, syntax.DIRECTIVE_CUSTOM_PREFIX)) {
              name = string.slice(name, syntax.DIRECTIVE_CUSTOM_PREFIX.length)
              addChild(
                new Directive(
                  string.camelCase(name)
                )
              )
            }
            else {
              addChild(
                new Attribute(
                  htmlStack[ 0 ].component
                  ? string.camelCase(name)
                  : name
                )
              )
            }
          }
          currentQuote = match[ 2 ]
          if (!currentQuote) {
            popStack(
              array.pop(htmlStack).type
            )
          }
          return match[ 0 ]
        }
      }
    },
    function (content) {
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
            new Text(text)
          )
        }
        if (closed) {
          text += currentQuote
          popStack(
            array.pop(htmlStack).type
          )
        }
        return text
      }
      else {
        let match = content.match(openingTagPattern)
        if (match && match.index) {
          content = string.slice(content, 0, match.index)
        }
        addChild(
          new Text(content)
        )
        return content
      }
    },
  ]

  const delimiterParsers = [
    function (source, terms) {
      if (string.startsWith(source, syntax.EACH)) {
        terms = string.split(slicePrefix(source, syntax.EACH), char.CHAR_COLON)
        return terms[ 0 ]
          ? new Each(
            compileExpression(string.trim(terms[ 0 ])),
            string.trim(terms[ 1 ])
          )
          : throwError('Expected each name', env.TRUE)
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.IMPORT)) {
        source = slicePrefix(source, syntax.IMPORT)
        return source
          ? new Import(source)
          : throwError('Expected import name', env.TRUE)
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.PARTIAL)) {
        source = slicePrefix(source, syntax.PARTIAL)
        return source
          ? new Partial(source)
          : throwError('Expected partial name', env.TRUE)
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.IF)) {
        source = slicePrefix(source, syntax.IF)
        return source
          ? new If(
            compileExpression(source)
          )
          : throwError('Expected if expression', env.TRUE)
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.ELSE_IF)) {
        source = slicePrefix(source, syntax.ELSE_IF)
        return source
          ? new ElseIf(
            compileExpression(source)
          )
          : throwError('Expected else if expression', env.TRUE)
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.ELSE)) {
        return new Else()
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.SPREAD)) {
        source = slicePrefix(source, syntax.SPREAD)
        return source
          ? new Spread(
            compileExpression(source)
          )
          : throwError('Expected spread name', env.TRUE)
      }
    },
    function (source, all) {
      if (!string.startsWith(source, syntax.COMMENT)) {
        source = string.trim(source)
        return source
          ? new Expression(
            compileExpression(source),
            !string.endsWith(all, '}}}')
          )
          : throwError('Expected expression', env.TRUE)
      }
    },
  ]

  let parseHtml = function (content) {
    if (content) {
      let tpl = content
      while (tpl) {
        array.each(
          htmlParsers,
          function (parse, match) {
            match = parse(tpl)
            if (match) {
              tpl = string.slice(tpl, match.length)
              return env.FALSE
            }
          }
        )
      }
      str = string.slice(str, content.length)
    }
  }

  let parseDelimiter = function (content, all) {
    if (content) {
      if (char.charAt(content) === '/') {
        let type = helper.name2Type[ string.slice(content, 1) ]
        if (helper.ifTypes[ type ]) {
          if (ifStack.length) {
            type = array.pop(ifStack).type
          }
          else {
            type = nodeType.ELSE
          }
        }
        popStack(type)
      }
      else {
        array.each(
          delimiterParsers,
          function (parse, node) {
            node = parse(content, all)
            if (node) {
              if (helper.elseTypes[ node.type ]) {
                popStack(
                  array.pop(ifStack).type
                )
              }
              addChild(node)
              return env.FALSE
            }
          }
        )
      }
    }
    str = string.slice(str, all.length)
  }

  let str = content, match
  while (str) {
    match = str.match(delimiterPattern)
    if (match) {
      parseHtml(
        string.slice(str, 0, match.index)
      )
      parseDelimiter(match[ 1 ], match[ 0 ])
    }
    else {
      parseHtml(str)
    }
  }

  if (nodeStack.length) {
    throwError(`Expected end tag (</${nodeStack[ 0 ].name}>)`)
  }

  return compileCache[ content ] = nodeList

}
