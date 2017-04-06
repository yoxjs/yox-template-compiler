
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'

import compileExpression from 'yox-expression-compiler/compile'

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

// if 带条件的
const ifTypes = { }
// if 分支的
const elseTypes = { }
// 属性层级的节点类型
const attrTypes = { }
// 叶子节点类型
const leafTypes = { }
// 内置指令，无需加前缀
const builtInDirectives = { }
// 名称和类型的映射
const name2Type = { }

ifTypes[ nodeType.IF ] =
ifTypes[ nodeType.ELSE_IF ] =

elseTypes[ nodeType.ELSE_IF ] =
elseTypes[ nodeType.ELSE ] =

attrTypes[ nodeType.ATTRIBUTE ] =
attrTypes[ nodeType.DIRECTIVE ] =

leafTypes[ nodeType.EXPRESSION ] =
leafTypes[ nodeType.IMPORT ] =
leafTypes[ nodeType.SPREAD ] =
leafTypes[ nodeType.TEXT ] =

builtInDirectives[ syntax.DIRECTIVE_REF ] =
builtInDirectives[ syntax.DIRECTIVE_LAZY ] =
builtInDirectives[ syntax.DIRECTIVE_MODEL ] =
builtInDirectives[ syntax.KEYWORD_UNIQUE ] = env.TRUE

name2Type[ 'if' ] = nodeType.IF
name2Type[ 'each' ] = nodeType.EACH
name2Type[ 'partial' ] = nodeType.PARTIAL

const delimiterPattern = /\{?\{\{\s*([^\}]+?)\s*\}\}\}?/
const openingTagPattern = /^\s*<(\/)?([a-z][-a-z0-9]*)/i
const closingTagPattern = /^\s*(\/)?>/
const attributePattern = /^\s*([-\w]+)(?:=(['"]))?/

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

  let nodeList = [ ], nodeStack = [ ], currentNode, currentQuote, htmlNode, ifNode

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
    throw new Error(`${msg}${char.CHAR_BREAKLINE}${content}`)
  }

  let pushStack = function (node) {
    if (currentNode) {
      array.push(nodeStack, currentNode)
    }
    else {
      array.push(nodeList, node)
    }
    currentNode = node
    if (attrTypes[ node.type ]) {
      htmlNode = node
    }
  }

  let popStack = function (type) {

    let index = -1
    array.each(
      nodeStack,
      function (node, i) {
        if (node.type === type) {
          index = i
          return env.FALSE
        }
      },
      env.TRUE
    )

    if (index < 0 && nodeStack.length) {
      throwError('start node is not found.' + type)
    }

    if (index === nodeStack.length - 1) {
      if (attrTypes[ currentNode.type ]) {
        array.each(
          nodeStack,
          function (node) {
            if (node.type === nodeType.ELEMENT) {
              htmlNode = node
              return env.FALSE
            }
          },
          env.TRUE
        )
      }
      currentNode = nodeStack.pop()
    }
    else {
      nodeStack.splice(index, 1)
    }

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

    if (currentNode) {
      if (htmlNode
        && htmlNode.type === nodeType.ELEMENT
        && currentNode.addAttr
      ) {
        currentNode.addAttr(node)
      }
      else {
        currentNode.addChild(node)
      }
    }

    if (!leafTypes[ type ]) {
      pushStack(node)
    }

  }

  const htmlParsers = [
    function (content) {
      if (!htmlNode) {
        let match = content.match(openingTagPattern)
        if (match) {
          let tagName = match[ 2 ]
          if (match[ 1 ] === '/') {
            popStack(
              nodeType.ELEMENT
            )
          }
          else {
            htmlNode = new Element(
              tagName,
              /[-A-Z]/.test(tagName)
            )
            addChild(htmlNode)
          }
          return match[ 0 ]
        }
      }
    },
    function (content) {
      if (htmlNode && htmlNode.type === nodeType.ELEMENT) {
        let match = content.match(closingTagPattern)
        if (match) {
          if (match[ 1 ] === '/'
            || /source|param|input|img|br/.test(htmlNode.name)
          ) {
            popStack(
              nodeType.ELEMENT
            )
          }
          htmlNode = env.NULL
          return match[ 0 ]
        }
      }
    },
    function (content) {
      if (htmlNode && htmlNode.type === nodeType.ELEMENT) {
        let match = content.match(attributePattern)
        if (match) {
          let name = match[ 1 ], node
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
                htmlNode.component
                ? string.camelCase(name)
                : name
              )
            )
          }
          currentQuote = match[ 2 ]
          return match[ 0 ]
        }
      }
    },
    function (content) {
      if (htmlNode) {
        if (attrTypes[ htmlNode.type ]) {
          let index = 0, currentChar, closed
          while (currentChar = char.chatAt(index)) {
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
              htmlNode.type
            )
          }
          return text
        }
      }
      else {
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
      console.log('parseHtml', content)
      let tpl = content
      while (tpl) {
        array.each(
          htmlParsers,
          function (parse, match) {
            console.log('parseHtml part', tpl)
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
      console.log('parseDelimiter', content)
      if (char.charAt(content) === '/') {
        popStack(
          name2Type[ string.slice(content, 1) ]
        )
      }
      else {
        array.each(
          delimiterParsers,
          function (parse, node) {
            node = parse(content, all)
            if (node) {
              addChild(node)
              if (ifNode && elseTypes[ node.type ]) {
                ifNode.then = node
              }
              if (ifTypes[ node.type ]) {
                ifNode = node
              }
              return env.FALSE
            }
          }
        )
      }
    }
    str = string.slice(str, 0, all.length)
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
    let node = nodeStack[ 0 ]
    throwError(`Expected end tag (</${node.name}>)`)
  }

  if (!nodeList.length) {
    array.push(
      nodeList,
      new Text(content)
    )
  }

  return compileCache[ content ] = nodeList

}
