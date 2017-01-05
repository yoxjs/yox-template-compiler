
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as expressionEnginer from 'yox-expression-compiler'

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

const EQUAL = 61         // =
const SLASH = 47         // /
const ARROW_LEFT = 60    // <
const ARROW_RIGHT = 62   // >
const BRACE_LEFT = 123   // {
const BRACE_RIGHT = 125  // }

const openingDelimiterPattern = new RegExp(syntax.DELIMITER_OPENING)
const closingDelimiterPattern = new RegExp(syntax.DELIMITER_CLOSING)

const elementPattern = /<(?:\/)?[-a-z]\w*/i
const elementEndPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(?==["'])?/i

const nonSingleQuotePattern = /^[^']*/
const nonDoubleQuotePattern = /^[^"]*/

const breaklinePrefixPattern = /^[ \t]*\n/
const breaklineSuffixPattern = /\n[ \t]*$/

const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /input|img|br/i

const { toString } = Function.prototype

// 2 种 level
// 当 level 为 LEVEL_ATTRIBUTE 时，表示只可以处理属性和指令
// 当 level 为 LEVEL_TEXT 时，表示只可以处理属性和指令的值
const LEVEL_ATTRIBUTE = 1
const LEVEL_TEXT = 2

// 属性层级的节点类型
const attrTypes = { }
attrTypes[ nodeType.ATTRIBUTE ] =
attrTypes[ nodeType.DIRECTIVE ] = env.TRUE

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


const NODES_FLAG = '$nodes'

function markNodes(nodes) {
  if (is.array(nodes)) {
    nodes[NODES_FLAG] = env.TRUE
  }
  return nodes
}

/**
 * 合并多个节点
 *
 * 用于处理属性值和指令值
 *
 * @param {?Array} nodes
 * @return {*}
 */
function mergeNodes(nodes) {
  if (is.array(nodes)) {
    let { length } = nodes
    // name=""
    if (length === 0) {
      return env.EMPTY
    }
    // name="{{value}}"
    else if (length === 1) {
      return nodes[0]
    }
    // name="{{value1}}{{value2}}"
    else if (length > 1) {
      return nodes.join(env.EMPTY)
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

  let value = enter(node)
  if (value !== env.FALSE) {
    if (!value) {
      let { children, attrs } = node
      if (is.array(children)) {
        children = traverseList(children, recursion)
      }
      if (is.array(attrs)) {
        attrs = traverseList(attrs, recursion)
      }
      value = leave(node, children, attrs)
    }
    return value
  }

}

/**
 * 遍历节点列表
 *
 * @param {Array.<Node>} nodes
 * @param {Function} recursion
 * @return {Array}
 */
function traverseList(nodes, recursion) {
  let list = markNodes([ ]), item
  let i = 0, node
  while (node = nodes[i]) {
    item = recursion(node)
    if (item !== env.UNDEFINED) {
      if (is.array(item) && !item[NODES_FLAG]) {
        list.push(item)
      }
      else {
        array.push(list, item)
      }
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
    return env.EMPTY
  }

  if (data) {
    keys = [ ]
    getKeypath = function () {
      return keypathUtil.stringify(keys)
    }
    getKeypath.toString = getKeypath
    data[ syntax.SPECIAL_KEYPATH ] = getKeypath
    context = new Context(data)
  }

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
            logger.error(`Importing partial "${name}" is not found.`)
            break

          // 条件判断失败就没必要往下走了
          case nodeType.IF:
          case nodeType.ELSE_IF:
            if (!executeExpr(expr)) {
              return env.FALSE
            }
            break

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

            let list = markNodes([ ])

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
                  list,
                  traverseList(children, recursion)
                )

                keys.pop()
                context = context.pop()

              }
            )

            keys.pop()
            context = context.pop()

            return list

        }

      },
      function (node, children, attrs) {

        let { type, name, subName, component, content } = node
        let keypath = getKeypath()

        switch (type) {
          case nodeType.TEXT:
            return markNodes(
              createText({
                keypath,
                content,
              })
            )


          case nodeType.EXPRESSION:
            let { expr, safe } = node
            content = executeExpr(expr)
            if (is.func(content) && content.toString !== toString) {
              content = content()
            }
            content = createText({
              safe,
              keypath,
              content,
            })
            return safe
              ? content
              : markNodes(content)

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
              let list = markNodes([ ])
              object.each(
                content,
                function (value, name) {
                  array.push(
                    list,
                    {
                      name,
                      value,
                      keypath,
                    }
                  )
                }
              )
              return list
            }
            break


          case nodeType.ELEMENT:
            let attributes = [ ], directives = [ ]
            if (attrs) {
              array.each(
                attrs,
                function (node) {
                  if (object.has(node, 'subName')) {
                    if (node.name && node.subName !== env.EMPTY) {
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

// 缓存编译结果
let cache = { }

const parsers = [
  {
    test(source) {
      return string.startsWith(source, syntax.EACH)
    },
    create(source) {
      let terms = string.trim(source.slice(syntax.EACH.length)).split(':')
      let expr = string.trim(terms[0])
      if (expr) {
        return new Each(
          expressionEnginer.compile(expr),
          string.trim(terms[1])
        )
      }
    }
  },
  {
    test(source) {
       return string.startsWith(source, syntax.IMPORT)
    },
    create(source) {
      let name = string.trim(source.slice(syntax.IMPORT.length))
      if (name) {
        return new Import(name)
      }
    }
  },
  {
    test(source) {
       return string.startsWith(source, syntax.PARTIAL)
    },
    create(source) {
      let name = string.trim(source.slice(syntax.PARTIAL.length))
      if (name) {
        return new Partial(name)
      }
    }
  },
  {
    test(source) {
       return string.startsWith(source, syntax.IF)
    },
    create(source) {
      let expr = string.trim(source.slice(syntax.IF.length))
      if (expr) {
        return new If(
          expressionEnginer.compile(expr)
        )
      }
    }
  },
  {
    test(source) {
      return string.startsWith(source, syntax.ELSE_IF)
    },
    create(source, delimiter, popStack) {
      let expr = source.slice(syntax.ELSE_IF.length)
      if (expr) {
        popStack()
        return new ElseIf(
          expressionEnginer.compile(expr)
        )
      }
    }
  },
  {
    test(source) {
      return string.startsWith(source, syntax.ELSE)
    },
    create(source, delimiter, popStack) {
      popStack()
      return new Else()
    }
  },
  {
    test(source) {
      return string.startsWith(source, syntax.SPREAD)
    },
    create(source) {
      let expr = source.slice(syntax.SPREAD.length)
      if (expr) {
        return new Spread(
          expressionEnginer.compile(expr)
        )
      }
    }
  },
  {
    test(source) {
      return !string.startsWith(source, syntax.COMMENT)
    },
    create(source, delimiter) {
      source = string.trim(source)
      if (source) {
        return new Expression(
          expressionEnginer.compile(source),
          !string.endsWith(delimiter, '}}}')
        )
      }
    }
  }
]

function getLocationByPos(str, pos) {

  let line = 0, col = 0, index = 0

  array.each(
    str.split(env.BREAKLINE),
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

  return { line, col }

}

/**
 * 是否是纯粹的换行
 *
 * @param {string} content
 * @return {boolean}
 */
function isBreakline(content) {
  return content.indexOf(env.BREAKLINE) >= 0
    && string.trim(content) === env.EMPTY
}

/**
 * trim 文本开始和结束位置的换行符
 *
 * @param {string} content
 * @return {boolean}
 */
function trimBreakline(content) {
  return content
    .replace(breaklinePrefixPattern, env.EMPTY)
    .replace(breaklineSuffixPattern, env.EMPTY)
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

  let result = cache[template]
  if (result) {
    return loose ? result : result[0]
  }

  // 当前内容
  let content
  // 记录标签名、属性名、指令名
  let name
  // 记录属性值、指令值的开始引号，方便匹配结束引号
  let quote
  // 标签是否子闭合
  let isSelfClosing
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

  let throwError = function (msg, pos) {
    if (pos == env.NULL) {
      msg += '.'
    }
    else {
      let { line, col } = getLocationByPos(template, pos)
      msg += `, at line ${line}, col ${col}.`
    }
    logger.error(`${msg}${env.BREAKLINE}${template}`)
  }

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
      if (isBreakline(content)
        || !(content = trimBreakline(content))
      ) {
        return
      }
      node.content = content
    }
    else if (type === nodeType.EXPRESSION
      && level === LEVEL_ATTRIBUTE
    ) {
      node = levelNode = new Attribute(node)
      type = nodeType.ATTRIBUTE
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

    if (attrTypes[type]) {
      level = LEVEL_TEXT
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

    result = parseAttributeValue(content, quote)
    if (result.value) {
      addChild(
        new Text(result.value)
      )
    }
    if (result.end) {
      popStack()
      level = LEVEL_ATTRIBUTE
    }
    return result.content

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
          while (content && (result = attributePattern.exec(content))) {
            content = content.slice(result.index + result[0].length)
            name = result[1]

            if (buildInDirectives[name]) {
              levelNode = new Directive(name)
            }
            else {
              if (string.startsWith(name, syntax.DIRECTIVE_EVENT_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_EVENT_PREFIX.length)
                levelNode = new Directive('event', name)
              }
              else if (string.startsWith(name, syntax.DIRECTIVE_CUSTOM_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_CUSTOM_PREFIX.length)
                levelNode = new Directive(name)
              }
              else {
                levelNode = new Attribute(name)
              }
            }

            addChild(levelNode)

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
                if (index) {
                  addChild(index)
                }
                else {
                  throwError('Expected expression', mainScanner.pos + helperScanner.pos)
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
        return throwError('Illegal tag name', mainScanner.pos)
      }
      else if (currentNode.type === nodeType.ELEMENT && name !== currentNode.name) {
        return throwError('Unexpected closing tag', mainScanner.pos)
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
        return throwError('Illegal tag name', mainScanner.pos)
      }

      if (isSelfClosing) {
        popStack()
      }
    }
  }

  if (nodeStack.length) {
    return throwError(`Expected end tag (</${nodeStack[0].name}>)`, mainScanner.pos)
  }

  let { children } = rootNode
  cache[template] = children

  if (loose) {
    return children
  }

  result = children[0]
  if (children.length > 1 || result.type !== nodeType.ELEMENT) {
    logger.error('Template should contain exactly one root element.')
  }
  return result

}
