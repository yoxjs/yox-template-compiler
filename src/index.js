
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

// 缓存编译结果
let cache = { }

const openingDelimiterPattern = new RegExp(syntax.DELIMITER_OPENING)
const closingDelimiterPattern = new RegExp(syntax.DELIMITER_CLOSING)

const elementPattern = /<(?:\/)?[-a-z]\w*/i
const elementEndPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(?==["'])?/i

const nonSingleQuotePattern = /^[^']*/
const nonDoubleQuotePattern = /^[^"]*/

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
    create(source, delimiter, popStack) {
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
    create(source, delimiter, popStack) {
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
    create(source, delimiter) {
      return new Expression(
        expressionEnginer.compile(source),
        !delimiter.endsWith('}}}')
      )
    }
  }
]

// 2 种 level
// 当 level 为 LEVEL_ATTRIBUTE 时，表示只可以处理属性和指令
// 当 level 为 LEVEL_TEXT 时，表示只可以处理属性和指令的值
const LEVEL_ATTRIBUTE = 1
const LEVEL_TEXT = 2

// 触发 level 变化的节点类型
const levelTypes = { }
levelTypes[ nodeType.ELEMENT ] =
levelTypes[ nodeType.ATTRIBUTE ] =
levelTypes[ nodeType.DIRECTIVE ] = env.TRUE

// 叶子节点类型
const leafTypes = { }
leafTypes[ nodeType.EXPRESSION ] =
leafTypes[ nodeType.IMPORT ] =
leafTypes[ nodeType.SPREAD ] =
leafTypes[ nodeType.TEXT ] = env.TRUE

// 内置指令，无需加前缀
const buildInDirectives = { }
buildInDirectives[ syntax.DIRECTIVE_REF ] =
buildInDirectives[ syntax.DIRECTIVE_LAZY ] =
buildInDirectives[ syntax.DIRECTIVE_MODEL ] =
buildInDirectives[ syntax.KEYWORD_UNIQUE ] = env.TRUE


/**
 * 合并多个节点
 *
 * 用于处理属性值，如 name="xx{{xx}}xx"  name="xx"  name="{{xx}}"
 *
 * @param {?Array} nodes
 * @return {*}
 */
function mergeNodes(nodes) {
  if (is.array(nodes)) {
    if (nodes.length === 1) {
      return nodes[0]
    }
    else if (nodes.length > 1) {
      return nodes.join('')
    }
  }
}

/**
 * 遍历节点树
 *
 * @param {Node} node
 * @param {Function} enter
 * @param {Function} leave
 * @param {Function} traverseList
 * @param {Function} recursion
 * @return {*}
 */
function traverseTree(node, enter, leave, traverseList, recursion) {

  let result = enter(node)
  if (result) {
    return result
  }
  else if (result === env.FALSE) {
    return
  }

  let { children, attrs } = node
  if (is.array(children)) {
    children = traverseList(children, recursion)
  }
  if (is.array(attrs)) {
    attrs = traverseList(attrs, recursion)
  }

  return leave(node, children, attrs)

}

/**
 * 遍历节点列表
 *
 * @param {Array.<Node>} nodes
 * @param {Function} recursion
 * @return {Array}
 */
function traverseList(nodes, recursion) {
  let list = [ ], item
  let i = 0, node
  while (node = nodes[i]) {
    item = recursion(node)
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

/**
 * 序列化表达式
 *
 * @param {Object} expr
 * @return {string}
 */
function stringifyExpr(expr) {
  return keypathUtil.normalize(
    expressionEnginer.stringify(expr)
  )
}

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Function} createText 创建文本节点
 * @param {Function} createElement 创建元素节点
 * @param {?Function} importTemplate 导入子模板，如果是纯模板，可不传
 * @param {?Object} data 渲染模板的数据，如果渲染纯模板，可不传
 * @return {Object} { node: x, deps: { } }
 */
export function render(ast, createText, createElement, importTemplate, data) {

  let context, keys
  let getKeypath = function () {
    return ''
  }

  if (data) {
    keys = [ ]
    getKeypath = function () {
      return keypathUtil.stringify(keys)
    }
    getKeypath.$computed = env.TRUE
    data[ syntax.SPECIAL_KEYPATH ] = getKeypath
    context = new Context(data)
  }

  let count = 0
  let partials = { }

  let deps = { }
  let executeExpr = function (expr) {
    let result = expressionEnginer.execute(expr, context)
    object.each(
      result.deps,
      function (value, key) {
        deps[ keypathUtil.resolve(getKeypath(), key) ] = value
      }
    )
    return result.value
  }

  let recursion = function (node) {
    return traverseTree(
      node,
      function (node) {

        let { type, name, expr } = node

        switch (type) {

          // 用时定义的子模块无需注册到组件实例
          case nodeType.PARTIAL:
            partials[name] = node
            return env.FALSE

          case nodeType.IMPORT:
            let partial = partials[name] || importTemplate(name)
            if (partial) {
              if (is.string(partial)) {
                return traverseList(
                  compile(partial, env.TRUE),
                  recursion
                )
              }
              return traverseList(partial.children, recursion)
            }
            logger.error(`Importing partial '${name}' is not found.`)
            break

          // 条件判断失败就没必要往下走了
          case nodeType.IF:
          case nodeType.ELSE_IF:
            if (!executeExpr(expr)) {
              return env.FALSE
            }
            break

          // each 比较特殊，只能放在 enter 里执行
          case nodeType.EACH:
            let { index, children } = node
            let value = executeExpr(expr)

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

            array.push(keys, stringifyExpr(expr))
            context = context.push(value)

            iterate(
              value,
              function (item, i) {
                if (index) {
                  context.set(index, i)
                }

                array.push(keys, i)
                context = context.push(item)

                array.push(
                  result,
                  traverseList(children, recursion)
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
          count++
        }

      },
      function (node, children, attrs) {

        let { type, name, subName, component, content } = node
        let keypath = getKeypath()

        if (object.has(levelTypes, type)) {
          count--
        }

        switch (type) {
          case nodeType.TEXT:
            return createText({
              keypath,
              content,
            })


          case nodeType.EXPRESSION:
            let { expr, safe } = node
            content = executeExpr(expr)
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
              name = executeExpr(name.expr)
            }
            return {
              name,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.DIRECTIVE:
            return {
              name,
              subName,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.IF:
          case nodeType.ELSE_IF:
          case nodeType.ELSE:
            return children


          case nodeType.SPREAD:
            content = executeExpr(node.expr)
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
            let attributes = [ ], directives = [ ]
            if (attrs) {
              array.each(
                attrs,
                function (node) {
                  if (object.has(node, 'subName')) {
                    if (node.name && node.subName !== '') {
                      array.push(directives, node)
                    }
                  }
                  else {
                    array.push(attributes, node)
                  }
                }
              )
            }
            if (!children) {
              children = [ ]
            }
            return createElement(
              {
                name,
                attributes,
                directives,
                children,
                keypath,
              },
              !count,
              component
            )
        }

      },
      traverseList,
      recursion
    )
  }

  let node = recursion(ast)

  return { node, deps }

}

/**
 * 解析属性值，传入开始引号，匹配结束引号
 *
 * @param {string} content
 * @param {string} quote
 * @return {Object}
 */
function parseAttributeValue(content, quote) {

  let result = {
    content,
  }

  let match = content.match(
    quote === '"'
    ? nonDoubleQuotePattern
    : nonSingleQuotePattern
  )

  if (match) {
    result.value = match[0]

    let { length } = match[0]
    if (string.charAt(content, length) === quote) {
      result.end = env.TRUE
      length++
    }
    if (length) {
      result.content = content.slice(length)
    }
  }

  return result

}

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} template
 * @param {?boolean} loose
 * @return {Object}
 */
export function compile(template, loose) {

  if (cache[template]) {
    return cache[template]
  }

  // 当前内容
  let content
  // 记录标签名、属性名、指令名
  let name
  // 记录属性值、指令值的开始引号，方便匹配结束引号
  let quote
  // 标签是否子闭合
  let isSelfClosing
  // 正则匹配结果
  let match
  // 分隔符
  let delimiter

  // 主扫描器
  let mainScanner = new Scanner(template)
  // 辅扫描器
  let helperScanner = new Scanner()

  let level, levelNode

  let nodeStack = [ ]
  let rootNode = new Element('root')
  let currentNode = rootNode

  let pushStack = function (node) {
    array.push(nodeStack, currentNode)
    currentNode = node
  }

  let popStack = function () {
    currentNode = nodeStack.pop()
    return currentNode
  }

  let addChild = function (node) {

    let { type, content } = node

    if (type === nodeType.TEXT) {
      if (content = util.trimBreakline(content)) {
        node.content = content
      }
      else {
        return
      }
    }

    if (level === LEVEL_ATTRIBUTE
      && currentNode.addAttr
    ) {
      currentNode.addAttr(node)
    }
    else {
      currentNode.addChild(node)
    }

    if (!leafTypes[type]) {
      pushStack(node)
    }

  }

  // 属性和指令支持以下 8 种写法：
  // 1. name
  // 2. name="value"
  // 3. name="{{value}}"
  // 4. name="prefix{{value}}suffix"
  // 5. {{name}}
  // 6. {{name}}="value"
  // 7. {{name}}="{{value}}"
  // 8. {{name}}="prefix{{value}}suffix"
  let parseAttribute = function (content) {

    if (array.falsy(levelNode.children)) {
      if (content && string.charCodeAt(content, 0) === EQUAL) {
        quote = string.charAt(content, 1)
        content = content.slice(2)
      }
      else {
        popStack()
        level = LEVEL_ATTRIBUTE
        return content
      }
    }

    match = parseAttributeValue(content, quote)
    if (match.value) {
      addChild(
        new Text(match.value)
      )
    }
    if (match.end) {
      popStack()
      level = LEVEL_ATTRIBUTE
    }
    return match.content

  }

  // 核心函数，负责分隔符和普通字符串的深度解析
  let parseContent = function (content) {
    helperScanner.init(content)
    while (helperScanner.hasNext()) {

      // 分隔符之前的内容
      content = helperScanner.nextBefore(openingDelimiterPattern)
      helperScanner.nextAfter(openingDelimiterPattern)

      if (content) {

        if (level === LEVEL_TEXT) {
          content = parseAttribute(content)
        }

        if (level === LEVEL_ATTRIBUTE) {
          while (content && (match = attributePattern.exec(content))) {
            content = content.slice(match.index + match[0].length)
            name = match[1]

            if (buildInDirectives[name]) {
              levelNode = new Directive(name)
            }
            else {
              if (name.startsWith(syntax.DIRECTIVE_EVENT_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_EVENT_PREFIX.length)
                levelNode = new Directive('event', name)
              }
              else if (name.startsWith(syntax.DIRECTIVE_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_PREFIX.length)
                levelNode = new Directive(name)
              }
              else {
                levelNode = new Attribute(name)
              }
            }

            addChild(levelNode)
            level = LEVEL_TEXT

            content = parseAttribute(content)

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
      // 结束分隔符
      delimiter = helperScanner.nextAfter(closingDelimiterPattern)

      if (content) {
        if (string.charCodeAt(content, 0) === SLASH) {
          popStack()
        }
        else {
          array.each(
            parsers,
            function (parser, index) {
              if (parser.test(content, delimiter)) {
                // 用 index 节省一个变量定义
                index = parser.create(content, delimiter, popStack)
                if (is.string(index)) {
                  util.parseError(template, index, mainScanner.pos + helperScanner.pos)
                }
                else if (level === LEVEL_ATTRIBUTE
                  && index.type === nodeType.EXPRESSION
                ) {
                  levelNode = new Attribute(index)
                  addChild(levelNode)
                  level = LEVEL_TEXT
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
    if (mainScanner.charCodeAt(0) !== ARROW_LEFT) {
      break
    }

    // 结束标签
    if (mainScanner.charCodeAt(1) === SLASH) {
      // 取出 </tagName
      content = mainScanner.nextAfter(elementPattern)
      name = content.slice(2)

      // 没有匹配到 >
      if (mainScanner.charCodeAt(0) !== ARROW_RIGHT) {
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
        levelNode = new Element(name, env.TRUE)
        isSelfClosing = env.TRUE
      }
      else {
        levelNode = new Element(name)
        isSelfClosing = selfClosingTagNamePattern.test(name)
      }

      addChild(levelNode)

      // 截取 <name 和 > 之间的内容
      // 用于提取 Attribute 和 Directive
      content = mainScanner.nextBefore(elementEndPattern)
      if (content) {
        level = LEVEL_ATTRIBUTE
        parseContent(content)
        level = env.NULL
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

  if (loose) {
    return cache[template] = children
  }

  let root = children[0]
  if (children.length > 1 || root.type !== nodeType.ELEMENT) {
    logger.error('Component template should contain exactly one root element.')
  }
  return cache[template] = root

}
