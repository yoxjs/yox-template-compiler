
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
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as expressionEnginer from 'yox-expression-compiler'

const EQUAL = 61         // =
const SLASH = 47         // /
const ARROW_LEFT = 60    // <
const ARROW_RIGHT = 62   // >
const BRACE_LEFT = 123   // {
const BRACE_RIGHT = 125  // }

let cache = { }

const openingDelimiterPattern = new RegExp(syntax.DELIMITER_OPENING)
const closingDelimiterPattern = new RegExp(syntax.DELIMITER_CLOSING)

const elementPattern = /<(?:\/)?[-a-z]\w*/i
const elementEndPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(=["'])?/i

const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /input|img|br/i

const ERROR_PARTIAL_NAME = 'Expected legal partial name'
const ERROR_EXPRESSION = 'Expected expression'

const parsers = [
  {
    test(source) {
      return source.startsWith(syntax.EACH)
    },
    create(source) {
      let terms = source.slice(syntax.EACH.length).trim().split(':')
      let expr = expressionEnginer.compile(terms[0])
      let index
      if (terms[1]) {
        index = terms[1].trim()
      }
      return new Each(expr, index)
    }
  },
  {
    test(source) {
       return source.startsWith(syntax.IMPORT)
    },
    create(source) {
      let name = source.slice(syntax.IMPORT.length).trim()
      return name
        ? new Import(name)
        : ERROR_PARTIAL_NAME
    }
  },
  {
    test(source) {
       return source.startsWith(syntax.PARTIAL)
    },
    create(source) {
      let name = source.slice(syntax.PARTIAL.length).trim()
      return name
        ? new Partial(name)
        : ERROR_PARTIAL_NAME
    }
  },
  {
    test(source) {
       return source.startsWith(syntax.IF)
    },
    create(source) {
      let expr = source.slice(syntax.IF.length).trim()
      return expr
        ? new If(expressionEnginer.compile(expr))
        : ERROR_EXPRESSION
    }
  },
  {
    test(source) {
      return source.startsWith(syntax.ELSE_IF)
    },
    create(source, popStack) {
      let expr = source.slice(syntax.ELSE_IF.length)
      if (expr) {
        popStack()
        return new ElseIf(expressionEnginer.compile(expr))
      }
      return ERROR_EXPRESSION
    }
  },
  {
    test(source) {
      return source.startsWith(syntax.ELSE)
    },
    create(source, popStack) {
      popStack()
      return new Else()
    }
  },
  {
    test(source) {
      return source.startsWith(syntax.SPREAD)
    },
    create(source) {
      let expr = source.slice(syntax.SPREAD.length)
      if (expr) {
        return new Spread(expressionEnginer.compile(expr))
      }
      return ERROR_EXPRESSION
    }
  },
  {
    test(source) {
      return !source.startsWith(syntax.COMMENT)
    },
    create(source) {
      let safe = env.TRUE
      if (source.startsWith('{')) {
        safe = env.FALSE
        source = source.slice(1)
      }
      return new Expression(
        expressionEnginer.compile(source),
        safe
      )
    }
  }
]

const LEVEL_ELEMENT = 0
const LEVEL_ATTRIBUTE = 1
const LEVEL_TEXT = 2

const levelTypes = { }
levelTypes[ nodeType.ELEMENT ] =
levelTypes[ nodeType.ATTRIBUTE ] =
levelTypes[ nodeType.DIRECTIVE ] = env.TRUE

const buildInDirectives = { }
buildInDirectives[ syntax.DIRECTIVE_REF ] =
buildInDirectives[ syntax.DIRECTIVE_LAZY ] =
buildInDirectives[ syntax.DIRECTIVE_MODEL ] =
buildInDirectives[ syntax.KEYWORD_UNIQUE ] = env.TRUE

export function render(ast, data, createText, createElement, addDeps) {

  let keys = [ ]
  let getKeypath = function () {
    return keypathUtil.stringify(keys)
  }
  getKeypath.$computed = env.TRUE
  data[ syntax.SPECIAL_KEYPATH ] = getKeypath

  let level = 0
  let partials = { }
  let context = new Context(data)

  let execute = function (expr) {
    let { value, deps } = expressionEnginer.execute(expr, context)
    if (addDeps) {
        addDeps(deps, getKeypath)
    }
    return value
  }

  let merge = function (nodes) {
    if (nodes.length === 1) {
      return nodes[0]
    }
    else if (nodes.length > 1) {
      return nodes.join('')
    }
  }

  let traverseList = function (nodes) {
    let list = [ ], item
    let i = 0, node
    while (node = nodes[i]) {
      item = walkTree(node)
      if (item) {
        array.push(list, item)
        if (node.type === nodeType.IF
          || node.type === nodeType.ELSE_IF
        ) {
          // 跳过后面紧跟着的 elseif else
          while (node = nodes[i + 1]) {
            if (node.type === nodeType.ELSE_IF
              || node.type === nodeType.ELSE
            ) {
              i++
            }
            else {
              break
            }
          }
        }
      }
      i++
    }
    return list
  }

  let traverseTree = function (node, enter, leave) {

    let result = enter(node)
    if (result) {
      return result
    }
    else if (result === env.FALSE) {
      return
    }

    let { children, attributes, directives } = node
    if (is.array(children)) {
      children = traverseList(children)
    }
    if (is.array(attributes)) {
      attributes = traverseList(attributes)
    }
    if (is.array(directives)) {
      directives = traverseList(directives)
    }

    return leave(node, children, attributes, directives)

  }

  let walkTree = function (root) {
    return traverseTree(
      root,
      function (node) {

        let { type, name } = node

        switch (type) {

          // 用时定义的子模块无需注册到组件实例
          case nodeType.PARTIAL:
            partials[name] = node
            return env.FALSE

          case nodeType.IMPORT:
            let partial = partials[name] || instance.partial(name)
            if (partial) {
              return traverseList(partial.children)
            }
            logger.error(`Importing partial '${name}' is not found.`)
            break

          // 条件判断失败就没必要往下走了
          case nodeType.IF:
          case nodeType.ELSE_IF:
            if (!execute(node.expr)) {
              return env.FALSE
            }
            break

          // each 比较特殊，只能放在 enter 里执行
          case nodeType.EACH:
            let { expr, index, children } = node
            let value = execute(expr)

            let iterate
            if (is.array(value)) {
              iterate = array.each
            }
            else if (is.object(value)) {
              iterate = object.each
            }
            else {
              return env.FALSE
            }

            let result = [ ]

            let keypath = keypathUtil.normalize(
              expressionEnginer.stringify(expr)
            )
            keys.push(keypath)
            context = context.push(value)

            iterate(
              value,
              function (item, i) {
                if (index) {
                  context.set(index, i)
                }

                keys.push(i)
                context = context.push(item)

                array.push(
                  result,
                  traverseList(children)
                )

                keys.pop()
                context = context.pop()

              }
            )

            keys.pop()
            context = context.pop()

            return result

        }

        if (object.has(levelTypes, type)) {
          level++
        }

      },
      function (node, children, attributes, directives) {

        let { type, name, subName, component, content } = node

        if (object.has(levelTypes, type)) {
          level--
        }

        let keypath = getKeypath()

        switch (type) {
          case nodeType.TEXT:
            return createText({
              keypath,
              content,
            })


          case nodeType.EXPRESSION:
            let { expr, safe } = node
            content = execute(expr)
            if (is.func(content) && content.$computed) {
              content = content()
            }
            return createText({
              safe,
              keypath,
              content,
            })


          case nodeType.ATTRIBUTE:
            if (name.type === nodeType.EXPRESSION) {
              name = execute(name.expr)
            }
            return {
              name,
              keypath,
              value: merge(children),
            }


          case nodeType.DIRECTIVE:
            return {
              name,
              subName,
              keypath,
              value: merge(children),
            }


          case nodeType.IF:
          case nodeType.ELSE_IF:
          case nodeType.ELSE:
            return children


          case nodeType.SPREAD:
            content = execute(node.expr)
            if (is.object(content)) {
              let result = [ ]
              object.each(
                content,
                function (value, name) {
                  array.push(
                    result,
                    {
                      name,
                      value,
                      keypath,
                    }
                  )
                }
              )
              return result
            }
            break


          case nodeType.ELEMENT:
            let options = {
              name,
              attributes,
              directives,
              keypath,
            }
            if (!component) {
              options.children = children
            }
            return createElement(options, !level, component)
        }

      }
    )
  }

  return walkTree(ast)

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

  // 当前内容
  let content
  // 记录标签名、属性名、指令名
  let name
  // 记录属性、指令值的开始引号，方便匹配结束引号
  let quote
  // 标签是否子闭合
  let isSelfClosing
  // 正则匹配结果
  let match

  // 主扫描器
  let mainScanner = new Scanner(template)
  // 辅扫描器
  let helperScanner = new Scanner()

  // level 有三级
  // 0 表示可以 add Element 和 Text
  // 1 表示只能 add Attribute 和 Directive
  // 2 表示只能 add Text

  let level = LEVEL_ELEMENT, levelNode

  let nodeStack = [ ]
  let rootNode = new Element('root')
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
        new Text(match)
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

        // 属性和指令支持以下 8 种写法：
        // 1. name
        // 2. name="value"
        // 3. name="{{value}}"
        // 4. name="prefix{{value}}suffix"
        // 5. {{name}}
        // 6. {{name}}="value"
        // 7. {{name}}="{{value}}"
        // 8. {{name}}="prefix{{value}}suffix"

        // 已开始解析属性或指令
        if (level === LEVEL_TEXT) {
          // 命中 8 种写法中的 3 4
          // 因为前面处理过 {{ }}，所以 levelNode 必定有 child
          if (levelNode.children.length) {
            content = parseAttributeValue(content)
          }
          else {
            // 命中 8 种写法中的 6 7 8
            if (string.charCodeAt(content, 0) === EQUAL) {
              quote = string.charAt(content, 1)
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
              levelNode = new Directive(name)
            }
            else {
              if (name.startsWith(syntax.DIRECTIVE_EVENT_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_EVENT_PREFIX.length)
                if (name) {
                  levelNode = new Directive('event', name)
                }
              }
              else if (name.startsWith(syntax.DIRECTIVE_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_PREFIX.length)
                levelNode = new Directive(name)
                if (!name || buildInDirectives[name]) {
                  levelNode.invalid = env.TRUE
                }
              }
              else {
                levelNode = new Attribute(name)
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
            new Text(content)
          )
        }

      }

      // 分隔符之间的内容
      content = helperScanner.nextBefore(closingDelimiterPattern)
      helperScanner.nextAfter(closingDelimiterPattern)

      if (content) {
        if (string.charCodeAt(content, 0) === SLASH) {
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
                  && index.type === nodeType.EXPRESSION
                ) {
                  levelNode = new Attribute(index)
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
      else if (currentNode.type === nodeType.ELEMENT && name !== currentNode.name) {
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
          new Element(name, env.TRUE)
        )
        isSelfClosing = env.TRUE
      }
      else {
        addChild(
          new Element(name)
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
  let root = children[0]

  if (children.length > 1 || root.type !== nodeType.ELEMENT) {
    logger.error('Component template should contain exactly one root element.')
  }

  return cache[template] = root

}
