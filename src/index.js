
import * as util from './util'
import * as syntax from './syntax'
import * as nodeType from './nodeType'

import Context from './helper/Context'
import Scanner from './helper/Scanner'

import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Each from './node/Each'
import Element from './node/Element'
import Else from './node/Else'
import ElseIf from './node/ElseIf'
import Expression from './node/Expression'
import If from './node/If'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Text from './node/Text'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as logger from 'yox-common/util/logger'
import * as expressionEnginer from 'yox-expression-compiler'

let cache = { }

const openingDelimiter = '\\{\\{\\s*'
const closingDelimiter = '\\s*\\}\\}'
const openingDelimiterPattern = new RegExp(openingDelimiter)
const closingDelimiterPattern = new RegExp(closingDelimiter)

const elementPattern = /<(?:\/)?[-a-z]\w*/i
const elementEndPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(=["'])?/i

const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /input|img|br/i

const ERROR_PARTIAL_NAME = 'Expected legal partial name'
const ERROR_EXPRESSION = 'Expected expression'

const parsers = [
  {
    test: function (source) {
      return source.startsWith(syntax.EACH)
    },
    create: function (source) {
      let terms = source.slice(syntax.EACH.length).trim().split(':')
      let expr = expressionEnginer.compile(terms[0])
      let index
      if (terms[1]) {
        index = terms[1].trim()
      }
      return new Each({ expr, index })
    }
  },
  {
    test: function (source) {
       return source.startsWith(syntax.IMPORT)
    },
    create: function (source) {
      let name = source.slice(syntax.IMPORT.length).trim()
      return name
        ? new Import({ name })
        : ERROR_PARTIAL_NAME
    }
  },
  {
    test: function (source) {
       return source.startsWith(syntax.PARTIAL)
    },
    create: function (source) {
      let name = source.slice(syntax.PARTIAL.length).trim()
      return name
        ? new Partial({ name })
        : ERROR_PARTIAL_NAME
    }
  },
  {
    test: function (source) {
       return source.startsWith(syntax.IF)
    },
    create: function (source) {
      let expr = source.slice(syntax.IF.length).trim()
      return expr
        ? new If({ expr: expressionEnginer.compile(expr) })
        : ERROR_EXPRESSION
    }
  },
  {
    test: function (source) {
      return source.startsWith(syntax.ELSE_IF)
    },
    create: function (source, popStack) {
      let expr = source.slice(syntax.ELSE_IF.length)
      if (expr) {
        popStack()
        return new ElseIf({ expr: expressionEnginer.compile(expr) })
      }
      return ERROR_EXPRESSION
    }
  },
  {
    test: function (source) {
      return source.startsWith(syntax.ELSE)
    },
    create: function (source, popStack) {
      popStack()
      return new Else()
    }
  },
  {
    test: function (source) {
      return source.startsWith(syntax.SPREAD)
    },
    create: function (source) {
      let expr = source.slice(syntax.SPREAD.length)
      if (expr) {
        return new Spread({ expr: expressionEnginer.compile(expr) })
      }
      return ERROR_EXPRESSION
    }
  },
  {
    test: function (source) {
      return !source.startsWith(syntax.COMMENT)
    },
    create: function (source) {
      let safe = env.TRUE
      if (source.startsWith('{')) {
        safe = env.FALSE
        source = source.slice(1)
      }
      return new Expression({
        expr: expressionEnginer.compile(source),
        safe,
      })
    }
  }
]

const LEVEL_ELEMENT = 0
const LEVEL_ATTRIBUTE = 1
const LEVEL_TEXT = 2

const buildInDirectives = { }
buildInDirectives[syntax.DIRECTIVE_REF] =
buildInDirectives[syntax.DIRECTIVE_LAZY] =
buildInDirectives[syntax.DIRECTIVE_MODEL] =
buildInDirectives[syntax.KEYWORD_UNIQUE] = env.TRUE

/**
 * 把抽象语法树渲染成 Virtual DOM
 *
 * @param {Object} ast
 * @param {Object} data
 * @return {Object}
 */
export function render(ast, data, partial) {

  let deps = { }

  return {
    root: ast.render({
      keys: [ ],
      context: new Context(data),
      partial,
      addDeps: function (childrenDeps) {
        object.extend(deps, childrenDeps)
      }
    }),
    deps,
  }

}

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} template
 * @return {Object}
 */
export function compile(template) {

  if (cache[template]) {
    return cache[template]
  }

  let name,
    quote,
    content,
    isSelfClosing,
    match

  let mainScanner = new Scanner(template)
  let helperScanner = new Scanner()

  // level 有三级
  // 0 表示可以 add Element 和 Text
  // 1 表示只能 add Attribute 和 Directive
  // 2 表示只能 add Text

  let level = LEVEL_ELEMENT, levelNode

  let nodeStack = [ ]
  let rootNode = new Element({ name: 'root' })
  let currentNode = rootNode

  let pushStack = function (node) {
    nodeStack.push(currentNode)
    currentNode = node
  }

  let popStack = function () {
    currentNode = nodeStack.pop()
    return currentNode
  }

  let addChild = function (node) {

    let { type, content, children } = node

    if (type === nodeType.TEXT) {
      if (content = util.trimBreakline(content)) {
        node.content = content
      }
      else {
        return
      }
    }

    if (node.invalid !== env.TRUE) {
      currentNode.addChild(node)
    }

    if (children) {
      pushStack(node)
    }
  }

  let parseAttributeValue = function (content) {
    match = util.matchByQuote(content, quote)
    if (match) {
      addChild(
        new Text({ content: match })
      )
    }
    let { length } = match
    if (content.charAt(length) === quote) {
      popStack()
      level--
      length++
    }
    if (length) {
      content = content.slice(length)
    }
    return content
  }

  // 核心函数，负责分隔符和普通字符串的深度解析
  let parseContent = function (content) {
    helperScanner.init(content)
    while (helperScanner.hasNext()) {

      // 分隔符之前的内容
      content = helperScanner.nextBefore(openingDelimiterPattern)
      helperScanner.nextAfter(openingDelimiterPattern)

      if (content) {

        // 支持以下 8 种写法：
        // 1. name
        // 2. name="value"
        // 3. name="{{value}}"
        // 4. name="prefix{{value}}suffix"
        // 5. {{name}}
        // 6. {{name}}="value"
        // 7. {{name}}="{{value}}"
        // 8. {{name}}="prefix{{value}}suffix"

        // 已开始解析 ATTRIBUTE 或 DIRECTIVE
        // 表示至少已经有了 name
        if (level === LEVEL_TEXT) {
          // 命中 8 种写法中的 3 4
          // 因为前面处理过 {{ }}，所以 levelNode 必定有 child
          if (levelNode.children.length) {
            content = parseAttributeValue(content)
          }
          else {
            // 命中 8 种写法中的 6 7 8
            if (content.charAt(0) === '=') {
              quote = content.charAt(1)
              content = content.slice(2)
            }
            // 命中 8 种写法中的 5
            else {
              popStack()
              level--
            }
            // 8 种写法中的 1 2 在下面的 if 会一次性处理完，逻辑走不进这里
          }
        }

        if (level === LEVEL_ATTRIBUTE) {
          // 下一个属性的开始
          while (content && (match = attributePattern.exec(content))) {
            content = content.slice(match.index + match[0].length)
            name = match[1]

            if (buildInDirectives[name]) {
              levelNode = new Directive({ name })
            }
            else {
              if (name.startsWith(syntax.DIRECTIVE_EVENT_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_EVENT_PREFIX.length)
                if (name) {
                  levelNode = new Directive({ name: 'event', subName: name })
                }
              }
              else if (name.startsWith(syntax.DIRECTIVE_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_PREFIX.length)
                levelNode = new Directive({ name })
                if (!name || buildInDirectives[name]) {
                  levelNode.invalid = env.TRUE
                }
              }
              else {
                levelNode = new Attribute({ name })
              }
            }

            addChild(levelNode)
            level++

            match = match[2]
            if (match) {
              quote = match.charAt(1)
              content = parseAttributeValue(content)
            }
            else {
              popStack()
              level--
            }
          }
        }
        else if (content) {
          addChild(
            new Text({ content })
          )
        }

      }

      // 分隔符之间的内容
      content = helperScanner.nextBefore(closingDelimiterPattern)
      helperScanner.nextAfter(closingDelimiterPattern)

      if (content) {
        if (content.charAt(0) === '/') {
          popStack()
        }
        else {
          if (content.charAt(0) === '{' && helperScanner.charAt(0) === '}') {
            helperScanner.forward(1)
          }
          array.each(
            parsers,
            function (parser, index) {
              if (parser.test(content)) {
                // 用 index 节省一个变量定义
                index = parser.create(content, popStack)
                if (is.string(index)) {
                  util.parseError(template, index, mainScanner.pos + helperScanner.pos)
                }
                else if (level === LEVEL_ATTRIBUTE
                  && node.type === nodeType.EXPRESSION
                ) {
                  levelNode = new Attribute({ name: index })
                  level++
                  addChild(levelNode)
                }
                else {
                  addChild(index)
                }
                return env.FALSE
              }
            }
          )
        }
      }

    }
  }

  while (mainScanner.hasNext()) {
    content = mainScanner.nextBefore(elementPattern)

    // 处理标签之间的内容
    if (content) {
      parseContent(content)
    }

    // 接下来必须是 < 开头（标签）
    // 如果不是标签，那就该结束了
    if (mainScanner.charAt(0) !== '<') {
      break
    }

    // 结束标签
    if (mainScanner.charAt(1) === '/') {
      // 取出 </tagName
      content = mainScanner.nextAfter(elementPattern)
      name = content.slice(2)

      // 没有匹配到 >
      if (mainScanner.charAt(0) !== '>') {
        return util.parseError(template, 'Illegal tag name', mainScanner.pos)
      }
      else if (name !== currentNode.name) {
        return util.parseError(template, 'Unexpected closing tag', mainScanner.pos)
      }

      popStack()

      // 过掉 >
      mainScanner.forward(1)
    }
    // 开始标签
    else {
      // 取出 <tagName
      content = mainScanner.nextAfter(elementPattern)
      name = content.slice(1)

      if (componentNamePattern.test(name)) {
        // 低版本浏览器不支持自定义标签，需要转成 div
        addChild(
          new Element({
            name: 'div',
            component: name,
          })
        )
        isSelfClosing = env.TRUE
      }
      else {
        addChild(
          new Element({ name })
        )
        isSelfClosing = selfClosingTagNamePattern.test(name)
      }

      // 截取 <name 和 > 之间的内容
      // 用于提取 Attribute 和 Directive
      content = mainScanner.nextBefore(elementEndPattern)
      if (content) {
        level++
        parseContent(content)
        level--
      }

      content = mainScanner.nextAfter(elementEndPattern)
      // 没有匹配到 > 或 />
      if (!content) {
        return util.parseError(template, 'Illegal tag name', mainScanner.pos)
      }

      if (isSelfClosing) {
        popStack()
      }
    }
  }

  if (nodeStack.length) {
    return util.parseError(template, `Missing end tag (</${nodeStack[0].name}>)`, mainScanner.pos)
  }

  let { children } = rootNode
  if (children.length > 1) {
    logger.error('Component template should contain exactly one root element.')
  }

  return cache[template] = children[0]

}
