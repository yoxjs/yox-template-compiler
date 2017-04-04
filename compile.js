
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'

import compileExpression from 'yox-expression-compiler/compile'

import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

import Scanner from './src/helper/Scanner'

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

const openingDelimiterPattern = /\{?\{\{\s*/
const closingDelimiterPattern = /\s*\}\}\}?/

const openingTagPattern = /<(?:\/)?[-a-z]\w*/i
const closingTagPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(?==["'])?/i

const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /source|param|input|img|br/i

// if 分支的
const elseTypes = { }
// 属性层级的节点类型
const attrTypes = { }
// 叶子节点类型
const leafTypes = { }
// 内置指令，无需加前缀
const builtInDirectives = { }

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
 * @param {string} template
 * @return {Array}
 */
export default function compile(content) {

  let result = compileCache[ content ]
  if (result) {
    return result
  }

  let currentNode, currentQuote
  const tplParsers = [
    function (content) {
      let match = content.match(/^\s*([-\w]+)=(['"])/)
      if (match) {
        let name = match[ 1 ], node
        if (string.startsWith(name, syntax.DIRECTIVE_EVENT_PREFIX)) {
          name = string.slice(name, syntax.DIRECTIVE_EVENT_PREFIX.length)
          node = new Directive(
            'event',
            string.camelCase(name)
          )
        }
        else if (string.startsWith(name, syntax.DIRECTIVE_CUSTOM_PREFIX)) {
          name = string.slice(name, syntax.DIRECTIVE_CUSTOM_PREFIX.length)
          node = new Directive(
            string.camelCase(name)
          )
        }
        else {
          if (levelNode.component) {
            name = string.camelCase(name)
          }
          node = new Attribute(name)
        }
        return node
      }
    },
    function (content) {
      let match = content.match(/^([^'"]+)['"]/)
      if (match) {
        return new Text(
          match[ 1 ]
        )
      }
    },
    function (content) {
      let match = content.match(/^\s*<(\/?[a-z][-a-z0-9]*)/i)
      if (match) {
        let tagName = match[ 1 ]
        if (string.startsWith(tagName, '/')) {
          popStack(
            string.slice(tagName, 1)
          )
        }
        else {
          return new Element(
            tagName,
            /[-A-Z]/.test(tagName)
          )
        }
      }
    },
    function () {
      let match = content.match(/^\s*\/?>/)
      if (match) {
        if (string.endsWith(match[ 0 ], '/>')
          || /source|param|input|img|br/.test(levelNode.name)
        ) {
          popStack()
        }
      }
    }
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
          : throwError('Expected each name')
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.IMPORT)) {
        source = slicePrefix(source, syntax.IMPORT)
        return source
          ? new Import(source)
          : throwError('Expected import name')
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.PARTIAL)) {
        source = slicePrefix(source, syntax.PARTIAL)
        return source
          ? new Partial(source)
          : throwError('Expected partial name')
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.IF)) {
        source = slicePrefix(source, syntax.IF)
        return source
          ? new If(
            compileExpression(source)
          )
          : throwError('Expected if expression')
      }
    },
    function (source) {
      if (string.startsWith(source, syntax.ELSE_IF)) {
        source = slicePrefix(source, syntax.ELSE_IF)
        return source
          ? new ElseIf(
            compileExpression(source)
          )
          : throwError('Expected else if expression')
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
          : throwError('Expected spread name')
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
          : throwError('Expected expression')
      }
    },
  ]

  let parseTpl = function (content) {
    if (content) {
      let tpl = content
      while (tpl) {
        array.each(
          tplParsers,
          function (parse, match) {
            match = parse(tpl)
            if (match) {
              tpl = string.slice(tpl, match.length)
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
        popStack(
          string.slice(content, 1)
        )
      }
      else {
        array.each(
          delimiterParsers,
          function (parse, node) {
            node = parse(content, all)
            if (node) {
              if (elseTypes[ node.type ]) {
                popStack()
              }
              addChild(node)
              return env.FALSE
            }
          }
        )
      }
    }
    str = string.slice(str, 0, all.length)
  }

  let nodes = [ ], nodeStack = [ ]

  let str = content, match
  while (str) {
    match = str.match(delimiterPattern)
    if (match) {
      parseTpl(
        string.slice(str, 0, match.index)
      )
      parseDelimiter(match[ 1 ], match[ 0 ])
    }
    else {
      parseTpl(str)
    }
  }

  if (nodeStack.length) {
    return throwError(`Expected end tag (</${nodeStack[ 0 ].name}>)`, mainScanner.pos)
  }

  if (!nodes.length) {
    array.push(
      nodes,
      new Text(content)
    )
  }

  return compileCache[ content ] = nodes

}
