
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
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

const openingDelimiterPattern = new RegExp(syntax.DELIMITER_OPENING)
const closingDelimiterPattern = new RegExp(syntax.DELIMITER_CLOSING)

const openingTagPattern = /<(?:\/)?[-a-z]\w*/i
const closingTagPattern = /(?:\/)?>/

const attributePattern = /([-:@a-z0-9]+)(?==["'])?/i

const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /source|param|input|img|br/i

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


/**
 * 标记节点数组，用于区分普通数组
 *
 * @param {*} nodes
 * @return {*}
 */
function makeNodes(nodes) {
  if (is.array(nodes)) {
    nodes[ char.CHAR_DASH ] = env.TRUE
  }
  return nodes
}

/**
 * 是否是节点数组
 *
 * @param {*} nodes
 * @return {boolean}
 */
function isNodes(nodes) {
  return is.array(nodes) && nodes[ char.CHAR_DASH ]
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
    switch (nodes.length) {
      // name=""
      case 0:
        return char.CHAR_BLANK
      // name="{{value}}"
      case 1:
        return nodes[ 0 ]
      // name="{{value1}}{{value2}}"
      default:
        return nodes.join(char.CHAR_BLANK)
    }
  }
}

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Function} createComment 创建注释节点
 * @param {Function} createElement 创建元素节点
 * @param {Function} importTemplate 导入子模板，如果是纯模板，可不传
 * @param {Object} data 渲染模板的数据，如果渲染纯模板，可不传
 * @return {Object} { node: x, deps: { } }
 */
export function render(ast, createComment, createElement, importTemplate, data) {

  let keys = [ ]
  let getKeypath = function () {
    return keypathUtil.stringify(keys)
  }
  getKeypath.toString = getKeypath

  data[ syntax.SPECIAL_KEYPATH ] = getKeypath
  let context = new Context(data)

  // 是否正在渲染属性
  let isAttrRendering

  let partials = { }

  let deps = { }
  let executeExpression = function (expr) {
    let result = expressionEnginer.execute(expr, context)
    object.each(
      result.deps,
      function (value, key) {
        deps[ keypathUtil.resolve(getKeypath(), key) ] = value
      }
    )
    return result.value
  }

  /**
   * 遍历节点树
   *
   * @param {Node} node
   * @param {Function} enter
   * @param {Function} leave
   * @return {*}
   */
  let traverseTree = function (node, enter, leave) {

    let value = enter(node)
    if (value !== env.FALSE) {
      if (!value) {
        let { children, attrs } = node
        let props = { }

        if (children) {
          if (node.type === nodeType.ELEMENT && children.length === 1) {
            let child = children[ 0 ]
            if (child.type === nodeType.EXPRESSION
              && child.safe === env.FALSE
            ) {
              props.innerHTML = executeExpression(child.expr)
              children = env.NULL
            }
          }
          if (children) {
            children = traverseList(children)
          }
        }
        if (attrs) {
          attrs = traverseList(attrs)
        }
        value = leave(node, children, attrs, props)
      }
      return value
    }

  }

  /**
   * 遍历节点列表
   *
   * @param {Array.<Node>} nodes
   * @return {Array}
   */
  let traverseList = function (nodes) {
    let list = [ ], i = 0, node, value
    while (node = nodes[ i ]) {
      value = recursion(node, nodes[ i + 1 ])
      if (value !== env.UNDEFINED) {
        if (isNodes(value)) {
          array.push(list, value)
        }
        else {
          list.push(value)
        }
        if (ifTypes[ node.type ]) {
          // 跳过后面紧跟着的 elseif else
          while (node = nodes[ i + 1 ]) {
            if (elseTypes[ node.type ]) {
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
    return makeNodes(list)
  }

  let recursion = function (node, nextNode) {
    return traverseTree(
      node,
      function (node) {

        let { type, name, expr } = node

        switch (type) {

          // 用时定义的子模块无需注册到组件实例
          case nodeType.PARTIAL:
            partials[ name ] = node
            return env.FALSE

          case nodeType.IMPORT:
            let partial = partials[ name ] || importTemplate(name)
            if (partial) {
              if (is.string(partial)) {
                partial = compile(partial)
              }
              else if (partial.type === nodeType.PARTIAL) {
                partial = partial.children
              }
              return is.array(partial)
                ? traverseList(partial)
                : recursion(partial)
            }
            throw new Error(`Importing partial "${name}" is not found.`)
            break

          // 条件判断失败就没必要往下走了
          case nodeType.IF:
          case nodeType.ELSE_IF:
            if (!executeExpression(expr)) {
              return isAttrRendering || !nextNode || elseTypes[ nextNode.type ]
                ? env.FALSE
                : makeNodes(createComment())
            }
            break

          case nodeType.EACH:
            let { index, children } = node
            let value = executeExpression(expr)

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

            let list = [ ]

            array.push(
              keys,
              keypathUtil.normalize(
                expressionEnginer.stringify(expr)
              )
            )
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
                  traverseList(children)
                )

                keys.pop()
                context = context.pop()

              }
            )

            keys.pop()
            context = context.pop()

            return makeNodes(list)

        }

        if (attrTypes[ type ]) {
          isAttrRendering = env.TRUE
        }

      },
      function (node, children, attrs, properties) {

        let { type, name, modifier, component, content } = node
        let keypath = getKeypath()

        if (attrTypes[ type ]) {
          isAttrRendering = env.FALSE
        }

        switch (type) {
          case nodeType.TEXT:
            return content


          case nodeType.EXPRESSION:
            return executeExpression(node.expr)


          case nodeType.ATTRIBUTE:
            return {
              name,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.DIRECTIVE:
            return {
              name,
              modifier,
              keypath,
              value: mergeNodes(children),
            }


          case nodeType.IF:
          case nodeType.ELSE_IF:
          case nodeType.ELSE:
            // 如果是空，也得是个空数组
            return children !== env.UNDEFINED
              ? children
              : makeNodes([ ])


          case nodeType.SPREAD:
            content = executeExpression(node.expr)
            if (is.object(content)) {
              let list = [ ]
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
              return makeNodes(list)
            }
            break


          case nodeType.ELEMENT:
            let attributes = [ ], directives = [ ]
            if (attrs) {
              array.each(
                attrs,
                function (node) {
                  if (object.has(node, 'modifier')) {
                    if (node.name && node.modifier !== char.CHAR_BLANK) {
                      array.push(directives, node)
                    }
                  }
                  else {
                    array.push(attributes, node)
                  }
                }
              )
            }
            return createElement(
              {
                name,
                keypath,
                properties,
                attributes,
                directives,
                children: children || [ ],
              },
              component
            )
        }

      }
    )
  }

  return {
    node: recursion(ast),
    deps,
  }

}

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

const STATUS_UNMATCHED = 1
const STATUS_FAILED = 2

const parsers = [
  function (source, terms) {
    if (string.startsWith(source, syntax.EACH)) {
      terms = string.split(slicePrefix(source, syntax.EACH), char.CHAR_COLON)
      return terms[ 0 ]
        ? new Each(
          expressionEnginer.compile(string.trim(terms[ 0 ])),
          string.trim(terms[ 1 ])
        )
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.IMPORT)) {
      source = slicePrefix(source, syntax.IMPORT)
      return source
        ? new Import(source)
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.PARTIAL)) {
      source = slicePrefix(source, syntax.PARTIAL)
      return source
        ? new Partial(source)
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.IF)) {
      source = slicePrefix(source, syntax.IF)
      return source
        ? new If(
          expressionEnginer.compile(source)
        )
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.ELSE_IF)) {
      source = slicePrefix(source, syntax.ELSE_IF)
      return source
        ? new ElseIf(
          expressionEnginer.compile(source)
        )
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.ELSE)) {
      return new Else()
    }
    return STATUS_UNMATCHED
  },
  function (source) {
    if (string.startsWith(source, syntax.SPREAD)) {
      source = slicePrefix(source, syntax.SPREAD)
      return source
        ? new Spread(
          expressionEnginer.compile(source)
        )
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
  function (source, delimiter) {
    if (!string.startsWith(source, syntax.COMMENT)) {
      source = string.trim(source)
      return source
        ? new Expression(
          expressionEnginer.compile(source),
          !string.endsWith(delimiter, '}}}')
        )
        : STATUS_FAILED
    }
    return STATUS_UNMATCHED
  },
]

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} template
 * @return {Array}
 */
export function compile(template) {

  let result = compileCache[ template ]
  if (result) {
    return result
  }

  // 第一级的所有节点
  let nodes = [ ]

  // 当前内容
  let content
  // 记录标签名、属性名、指令名
  let name

  // 主扫描器
  let mainScanner = new Scanner(template)
  // 辅扫描器
  let helperScanner = new Scanner()

  let nodeStack = [ ]
  let currentNode, levelNode

  let throwError = function (msg, pos) {
    if (pos == env.NULL) {
      msg += char.CHAR_DOT
    }
    else {
      let line = 0, col = 0, index = 0
      array.each(
        template.split(char.CHAR_BREAKLINE),
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
    throw new Error(`${msg}${char.CHAR_BREAKLINE}${template}`)
  }

  let pushStack = function (node) {
    if (currentNode) {
      array.push(nodeStack, currentNode)
    }
    else {
      array.push(nodes, node)
    }
    currentNode = node
    if (attrTypes[ node.type ]) {
      levelNode = node
    }
  }

  let popStack = function () {
    if (attrTypes[ currentNode.type ]) {
      array.each(
        nodeStack,
        function (node) {
          if (node.type === nodeType.ELEMENT) {
            levelNode = node
            return env.FALSE
          }
        },
        env.TRUE
      )
    }
    currentNode = nodeStack.pop()
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
      if (levelNode
        && levelNode.type === nodeType.ELEMENT
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

    return node

  }

  // 属性和指令支持以下 4 种写法：
  // 1. name
  // 2. name="value"
  // 3. name="{{value}}"
  // 4. name="prefix{{value}}suffix"
  let parseAttribute = function (content) {

    if (array.falsy(levelNode.children)) {
      if (content && char.codeAt(content) === char.CODE_EQUAL) {
        // 第一个是引号
        result = char.charAt(content, 1)
        content = string.slice(content, 2)
      }
      else {
        popStack()
        return content
      }
    }

    let i = 0, currentChar, closed
    while (currentChar = char.charAt(content, i)) {
      // 如果是引号，属性值匹配结束
      if (currentChar === result) {
        closed = env.TRUE
        break
      }
      i++
    }

    if (i) {
      addChild(
        new Text(string.slice(content, 0, i))
      )
      content = string.slice(content, closed ? (i + 1) : i)
    }

    if (closed) {
      popStack()
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

        if (levelNode && attrTypes[ levelNode.type ]) {
          content = parseAttribute(content)
        }

        if (levelNode && levelNode.type === nodeType.ELEMENT) {
          while (content && (result = attributePattern.exec(content))) {
            content = string.slice(content, result.index + result[ 0 ].length)
            name = result[ 1 ]

            if (builtInDirectives[ name ]) {
              addChild(
                new Directive(
                  string.camelCase(name)
                )
              )
            }
            else {
              if (string.startsWith(name, syntax.DIRECTIVE_EVENT_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_EVENT_PREFIX.length)
                addChild(
                  new Directive(
                    'event',
                    string.camelCase(name)
                  )
                )
              }
              else if (string.startsWith(name, syntax.DIRECTIVE_CUSTOM_PREFIX)) {
                name = name.slice(syntax.DIRECTIVE_CUSTOM_PREFIX.length)
                addChild(
                  new Directive(
                    string.camelCase(name)
                  )
                )
              }
              else {
                if (levelNode.component) {
                  name = string.camelCase(name)
                }
                addChild(
                  new Attribute(name)
                )
              }
            }
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
      name = helperScanner.nextAfter(closingDelimiterPattern)

      if (content) {
        if (char.codeAt(content) === char.CODE_SLASH) {
          popStack()
        }
        else {
          array.each(
            parsers,
            function (parse, index) {
              index = parse(content, name)
              if (index !== STATUS_UNMATCHED) {
                if (index === STATUS_FAILED) {
                  throwError('Expected expression', mainScanner.pos + helperScanner.pos)
                }
                else {
                  if (elseTypes[ index.type ]) {
                    popStack()
                  }
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
    content = mainScanner.nextBefore(openingTagPattern)

    // 处理标签之间的内容
    if (content) {
      parseContent(content)
    }

    // 接下来必须是 < 开头（标签）
    // 如果不是标签，那就该结束了
    if (mainScanner.codeAt(0) !== char.CODE_LEFT) {
      break
    }

    // 结束标签
    if (mainScanner.codeAt(1) === char.CODE_SLASH) {
      // 取出 </tagName
      content = mainScanner.nextAfter(openingTagPattern)
      name = string.slice(content, 2)

      // 没有匹配到 >
      if (mainScanner.codeAt(0) !== char.CODE_RIGHT) {
        return throwError('Illegal tag name', mainScanner.pos)
      }
      else if (name !== currentNode.name) {
        return throwError('Unexpected closing tag', mainScanner.pos)
      }

      popStack()

      // 过掉 >
      mainScanner.forward(1)
    }
    // 开始标签
    else {
      // 取出 <tagName
      content = mainScanner.nextAfter(openingTagPattern)
      name = string.slice(content, 1)

      levelNode = addChild(
        new Element(
          name,
          componentNamePattern.test(name)
        )
      )

      // 截取 <name 和 > 之间的内容
      // [TODO]
      // 用于提取 Attribute 和 Directive
      // 如果这段内容包含 >，如表达式里有 "a > b"，会有问题
      // 因此必须区分 "..." 或 {{...}} 里的 >
      content = mainScanner.nextBefore(closingTagPattern)
      if (content) {
        parseContent(content)
      }

      content = mainScanner.nextAfter(closingTagPattern)
      // 没有匹配到 > 或 />
      if (!content) {
        return throwError('Illegal tag name', mainScanner.pos)
      }

      if (levelNode.component
        || selfClosingTagNamePattern.test(levelNode.name)
        || char.codeAt(content) === char.CODE_SLASH
      ) {
        popStack()
      }

      levelNode = env.NULL

    }
  }

  if (nodeStack.length) {
    return throwError(`Expected end tag (</${nodeStack[ 0 ].name}>)`, mainScanner.pos)
  }

  if (!nodes.length) {
    array.push(
      nodes,
      new Text(template)
    )
  }

  return compileCache[ template ] = nodes


}
