
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'

import * as config from 'yox-config'

import * as expressionNodeType from 'yox-expression-compiler/src/nodeType'
import compileExpression from 'yox-expression-compiler/compile'
import Binary from 'yox-expression-compiler/src/node/Binary'
import Ternary from 'yox-expression-compiler/src/node/Ternary'
import Literal from 'yox-expression-compiler/src/node/Literal'

import * as helper from './src/helper'
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

const delimiterPattern = /(\{?\{\{)\s*([^\}]+?)\s*(\}\}\}?)/
const openingTagPattern = /<(\/)?([a-z][-a-z0-9]*)/i
const closingTagPattern = /^\s*(\/)?>/
const attributePattern = /^\s*([-:\w]+)(?:=(['"]))?/
const componentNamePattern = /[-A-Z]/
const selfClosingTagNamePattern = /area|base|embed|track|source|param|input|col|img|br|hr/

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
 * 把一堆插值优化成表达式
 *
 * @param {Array} children
 */
function optimizeExpression(children) {

  // "xxx{{name}}" => 优化成 {{ 'xxx' + name }}
  // "xxx{{name1}}{{name2}} => 优化成 {{ 'xxx' + name1 + name2 }}"

  let current

  let addNode = function (node) {
    if (!current) {
      current = node
    }
    else {
      current = new Binary(
        char.CHAR_BLANK,
        current,
        '+',
        node
      )
    }
  }

  array.each(
    children,
    function (child) {
      let { type, expr, text } = child
      if (type === nodeType.EXPRESSION
        && expr.raw !== config.SPECIAL_CHILDREN
      ) {
        addNode(child.expr)
      }
      else if (type === nodeType.TEXT) {
        addNode(new Literal(char.CHAR_BLANK, text))
      }
      else if (type === nodeType.IF) {

        let list = [ ], children

        let append = function (node) {
          let last = array.last(list)
          if (last) {
            last.no = node
          }
          array.push(list, node)
        }

        while (child) {
          children = child.children
          if (children) {
            children = optimizeExpression(children)
            if (children) {
              children = children.expr
            }
            else {
              current = env.NULL
              return env.FALSE
            }
          }
          if (!children) {
            children = new Literal(char.CHAR_BLANK, char.CHAR_BLANK)
          }
          if (child.expr) {
            append(
              new Ternary(
                char.CHAR_BLANK,
                child.expr,
                children,
                new Literal(char.CHAR_BLANK, char.CHAR_BLANK)
              )
            )
          }
          else {
            append(
              children
            )
          }
          child = child.next
        }

        addNode(list[ 0 ])
      }
      else {
        current = env.NULL
        return env.FALSE
      }
    }
  )

  if (current) {
    return new Expression(
      current,
      env.TRUE
    )
  }

}

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} content
 * @return {Array}
 */
export default function compile(content) {

  let nodeList = compileCache[ content ]
  if (nodeList) {
    return nodeList
  }
  nodeList = [ ]

  let nodeStack = [ ], ifStack = [ ], htmlStack = [ ], currentQuote

  let throwError = function (msg) {
    logger.fatal(`Error compiling template:${char.CHAR_BREAKLINE}${content}${char.CHAR_BREAKLINE}- ${msg}`)
  }

  let popSelfClosingElementIfNeeded = function (popingTagName) {
    let lastNode = array.last(nodeStack)
    if (lastNode
      && lastNode.type === nodeType.ELEMENT
      && lastNode.name !== popingTagName
      && selfClosingTagNamePattern.test(lastNode.name)
    ) {
      popStack(
        nodeType.ELEMENT,
        lastNode.name
      )
    }
  }

  let popStack = function (type, expectedTagName) {

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
          target = nodeStack.splice(i, 1)[ 0 ]
          return env.FALSE
        }
      },
      env.TRUE
    )

    if (target) {

      let { name, divider, children, component } = target
      if (type === nodeType.ELEMENT && expectedTagName && name !== expectedTagName) {
        throwError(`end tag expected </${name}> to be </${expectedTagName}>.`)
      }

      if (is.number(divider)) {
        delete target.divider
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

        let realChildren = children.slice(divider)
        if (realChildren.length > 1) {
          let result = optimizeExpression(realChildren)
          if (result) {
            children.length = divider
            array.push(children, result)
          }
        }

        if (children.length - divider === 1) {
          let singleChild = array.last(children)
          if (singleChild.type === nodeType.TEXT) {
            if (component) {
              let attr = new Attribute(config.SPECIAL_CHILDREN)
              attr.children = [ singleChild ]
              children[ divider ] = attr
            }
            else {
              target.props = {
                innerText: singleChild.text
              }
              array.pop(children)
            }
          }
          else if (singleChild.type === nodeType.EXPRESSION
            && singleChild.expr.raw !== config.SPECIAL_CHILDREN
          ) {
            if (component) {
              let attr = new Attribute(config.SPECIAL_CHILDREN)
              attr.children = [ singleChild ]
              children[ divider ] = attr
            }
            else {
              let props = { }
              if (singleChild.safe === env.FALSE) {
                props.innerHTML = singleChild.expr
              }
              else {
                props.innerText = singleChild.expr
              }
              target.props = props
              array.pop(children)
            }
          }

          if (!children.length) {
            delete target.children
          }

        }
      }
      else {

        if (children.length > 1) {
          let result = optimizeExpression(children)
          if (result) {
            children.length = 0
            array.push(children, result)
          }
        }

        let singleChild = children.length === 1 && children[ 0 ]

        if (type === nodeType.ATTRIBUTE) {
          // 把数据从属性中提出来，减少渲染时的遍历
          let element = array.last(htmlStack)
          // <div key="xx">
          if (name === config.KEYWORD_UNIQUE) {
            array.remove(element.children, target)
            if (!element.children.length) {
              delete element.children
            }
            if (singleChild) {
              // 为了提升性能，这些特殊属性不支持插值
              if (singleChild.type === nodeType.TEXT) {
                element.key = singleChild.text
              }
              else if (singleChild.type === nodeType.EXPRESSION) {
                element.key = singleChild.expr
              }
            }
          }
        }
        else if (singleChild) {
          if (singleChild.type === nodeType.TEXT) {
            // 指令的值如果是纯文本，可以预编译表达式，提升性能
            if (type === nodeType.DIRECTIVE) {
              target.expr = compileExpression(singleChild.text)
              target.value = singleChild.text
              delete target.children
            }
            // 属性的值如果是纯文本，直接获取文本值
            // 减少渲染时的遍历
            else if (type === nodeType.ATTRIBUTE) {
              target.value = singleChild.text
              delete target.children
            }
          }
          // <div class="{{className}}">
          // 把 Attribute 转成 单向绑定 指令，可实现精确更新视图
          else if (type === nodeType.ATTRIBUTE
            && singleChild.type === nodeType.EXPRESSION
          ) {
            let { expr } = singleChild
            target.expr = expr
            delete target.children
            if (is.string(expr.keypath)) {
              target.binding = expr.keypath
            }
          }
        }
      }
    }
    else {
      throwError(`{{/${helper.type2Name[ type ]}}} is not a pair.`)
    }

  }

  let addChild = function (node) {

    let { type, text } = node

    if (type === nodeType.TEXT) {
      if (isBreakline(text)
        || !(text = trimBreakline(text))
      ) {
        return
      }
      node.text = text
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

    if (helper.elseTypes[ type ]) {
      let ifNode = array.pop(ifStack)
      ifNode.next = node
      popStack(ifNode.type)
      array.push(ifStack, node)
      array.push(nodeStack, node)
      return
    }

    let prevNode

    let currentNode = array.last(nodeStack)
    if (currentNode) {
      let { children, divider } = currentNode
      if (children) {
        if (children.length !== divider) {
          prevNode = children[ children.length - 1 ]
        }
      }
      else {
        children = currentNode.children = [ ]
      }
      array.push(children, node)
    }
    else {
      prevNode = array.last(nodeList)
      array.push(nodeList, node)
    }

    // 上一个 if 节点没有 else 分支
    // 在渲染时，如果这种 if 分支为 false，需要加上注释节点
    if (prevNode
      && helper.ifTypes[ prevNode.type ]
      && !htmlStack.length
    ) {
      prevNode.stump = env.TRUE
    }

    if (helper.ifTypes[ type ]) {
      array.push(ifStack, node)
    }
    else if (helper.htmlTypes[ type ]) {
      array.push(htmlStack, node)
    }

    if (!helper.leafTypes[ type ]) {
      array.push(nodeStack, node)
    }

  }

  const htmlParsers = [
    function (content) {
      if (!htmlStack.length) {
        let match = content.match(openingTagPattern)
        // 必须以 <tag 开头才能继续
        if (match && !match.index) {
          let tagName = match[ 2 ]
          if (match[ 1 ] === char.CHAR_SLASH) {
            popStack(
              nodeType.ELEMENT,
              tagName
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
          let element = array.last(htmlStack)
          element.divider = element.children ? element.children.length : 0
          if (match[ 1 ] === char.CHAR_SLASH) {
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
          else if (string.startsWith(name, config.DIRECTIVE_EVENT_PREFIX)) {
            name = string.slice(name, config.DIRECTIVE_EVENT_PREFIX.length)
            addChild(
              new Directive(
                config.DIRECTIVE_EVENT,
                string.camelCase(name)
              )
            )
          }
          else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
            name = string.slice(name, config.DIRECTIVE_CUSTOM_PREFIX.length)
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
          closed = array.pop(htmlStack)
          if (!closed.children) {
            closed.value = char.CHAR_BLANK
          }
          popStack(closed.type)
        }
        return text
      }
      else {
        let match = content.match(openingTagPattern)
        if (match && match.index) {
          content = string.slice(content, 0, match.index)
        }
        // 属性级别的空字符串是没有意义的
        // 比如 <div      class="xx">
        if (htmlStack.length !== 1
          || string.trim(content)
        ) {
          addChild(
            new Text(content)
          )
        }
        return content
      }
    },
  ]

  const delimiterParsers = [
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_EACH)) {
        let terms = string.split(slicePrefix(source, config.SYNTAX_EACH), char.CHAR_COLON)
        if (terms[ 0 ]) {
          return new Each(
            compileExpression(string.trim(terms[ 0 ])),
            string.trim(terms[ 1 ])
          )
        }
        throwError(`invalid each: ${all}`)
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_IMPORT)) {
        source = slicePrefix(source, config.SYNTAX_IMPORT)
        return source
          ? new Import(source)
          : throwError(`invalid import: ${all}`)
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_PARTIAL)) {
        source = slicePrefix(source, config.SYNTAX_PARTIAL)
        return source
          ? new Partial(source)
          : throwError(`invalid partial: ${all}`)
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_IF)) {
        source = slicePrefix(source, config.SYNTAX_IF)
        return source
          ? new If(
            compileExpression(source)
          )
          : throwError(`invalid if: ${all}`)
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_ELSE_IF)) {
        source = slicePrefix(source, config.SYNTAX_ELSE_IF)
        return source
          ? new ElseIf(
            compileExpression(source)
          )
          : throwError(`invalid else if: ${all}`)
      }
    },
    function (source) {
      if (string.startsWith(source, config.SYNTAX_ELSE)) {
        return new Else()
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_SPREAD)) {
        source = slicePrefix(source, config.SYNTAX_SPREAD)
        return source
          ? new Spread(
            compileExpression(source)
          )
          : throwError(`invalid spread: ${all}`)
      }
    },
    function (source, all) {
      if (!config.SYNTAX_COMMENT.test(source)) {
        source = string.trim(source)
        return source
          ? new Expression(
            compileExpression(source),
            !string.endsWith(all, '}}}')
          )
          : throwError(`invalid expression: ${all}`)
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
      if (char.charAt(content) === char.CHAR_SLASH) {
        let name = string.slice(content, 1), type = helper.name2Type[ name ]
        if (helper.ifTypes[ type ]) {
          type = array.pop(ifStack).type
        }
        popStack(type)
      }
      else {
        array.each(
          delimiterParsers,
          function (parse, node) {
            node = parse(content, all)
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

  let str = content, match

  // 干掉 html 注释
  str = str.replace(
    /<!--[\s\S]*?-->/g,
    function () {
      return char.CHAR_BLANK
    }
  )

  while (str) {
    match = str.match(delimiterPattern)
    if (match) {
      parseHtml(
        string.slice(str, 0, match.index)
      )
      // 避免手误写成 {{{ name }}
      if (match[ 1 ].length === match[ 3 ].length) {
        parseDelimiter(match[ 2 ], match[ 0 ])
      }
      else {
        throwError(`invalid syntax: ${match[ 0 ]}`)
      }
    }
    else {
      parseHtml(str)
    }
  }

  return compileCache[ content ] = nodeList

}
