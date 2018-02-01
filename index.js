
import isDef from 'yox-common/function/isDef'
import toString from 'yox-common/function/toString'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as config from 'yox-config'
import * as snabbdom from 'yox-snabbdom'

import * as expressionCompiler from 'yox-expression-compiler/compile'

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
const selfClosingTagNames = [ 'area', 'base', 'embed', 'track', 'source', 'param', 'input', 'col', 'img', 'br', 'hr' ]

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
 * 换行符比较神奇，有时候你明明看不到换行符，却真的存在一个，那就是 \r
 *
 * @param {string} content
 * @return {string}
 */
function trimBreakline(content) {
  return content.replace(
    /^\s*[\n\r]\s*|\s*[\n\r]\s*$/g,
    char.CHAR_BLANK
  )
}

/**
 * 把模板编译为抽象语法树
 *
 * @param {string} content
 * @return {Array}
 */
export function compile(content) {

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
      && array.has(selfClosingTagNames, lastNode.name)
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
        if (children.length - divider === 1) {
          let singleChild = array.last(children)
          // 子节点是纯文本
          if (singleChild.type === nodeType.TEXT) {
            if (component) {
              let attr = new Attribute(config.SPECIAL_CHILDREN)
              attr.children = [ singleChild ]
              children[ divider ] = attr
            }
            else {
              target.props = {
                textContent: singleChild.text
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
                props.textContent = singleChild.expr
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

        let singleChild = children.length === 1 && children[ 0 ]

        if (type === nodeType.ATTRIBUTE) {
          // <div key="xx">
          // <div ref="xx">
          if (name === config.KEYWORD_UNIQUE || name === config.KEYWORD_REF) {
            // 把数据从属性中提出来，减少渲染时的遍历
            let element = array.last(htmlStack)
            array.remove(element.children, target)
            if (!element.children.length) {
              delete element.children
            }
            if (singleChild) {
              if (singleChild.type === nodeType.TEXT) {
                element[ name ] = singleChild.text
              }
              else if (singleChild.type === nodeType.EXPRESSION) {
                element[ name ] = singleChild.expr
              }
            }
            else {
              element[ name ] = target.children
            }
            return
          }
        }

        if (singleChild) {
          if (singleChild.type === nodeType.TEXT) {
            // 指令的值如果是纯文本，可以预编译表达式，提升性能
            let { text } = singleChild
            if (type === nodeType.DIRECTIVE) {
              target.expr = expressionCompiler.compile(text)
              target.value = text
              delete target.children
            }
            // 属性的值如果是纯文本，直接获取文本值
            // 减少渲染时的遍历
            else if (type === nodeType.ATTRIBUTE) {
              target.value = text
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
            if (is.string(expr.staticKeypath)) {
              target.binding = expr.staticKeypath
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
            expressionCompiler.compile(string.trim(terms[ 0 ])),
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
            expressionCompiler.compile(source)
          )
          : throwError(`invalid if: ${all}`)
      }
    },
    function (source, all) {
      if (string.startsWith(source, config.SYNTAX_ELSE_IF)) {
        source = slicePrefix(source, config.SYNTAX_ELSE_IF)
        return source
          ? new ElseIf(
            expressionCompiler.compile(source)
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
            expressionCompiler.compile(source)
          )
          : throwError(`invalid spread: ${all}`)
      }
    },
    function (source, all) {
      if (!config.SYNTAX_COMMENT.test(source)) {
        source = string.trim(source)
        return source
          ? new Expression(
            expressionCompiler.compile(source),
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
          let node = array.pop(ifStack)
          if (node) {
            type = node.type
          }
          else {
            throwError(`if is not begined.`)
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

/**
 * 把抽象语法树转成可执行的渲染函数
 *
 * @param {Array} ast
 * @return {Array}
 */
export function convert(ast) {
  return ast.map(
    function (item) {
      return new Function('a', 'c', 'm', 'e', 'o', 's', 'p', 'i', `return ${item.stringify()}`)
    }
  )
}

/**
 * 渲染抽象语法树
 *
 * @param {Function} render 编译出来的渲染函数
 * @param {Function} getter 表达式求值函数
 * @param {Function} setter 设值函数，用于存储模板渲染过程中的临时变量
 * @param {Yox} instance 组件实例
 * @return {Object}
 */
export function render(render, getter, setter, instance) {

  /**
   *
   * 表达式求值，通常是从当前层级依次往上查找，如果到根层级还找不到，返回 undefined
   *
   * 层级只会因为 each 改变，其他语法不具有这个能力。
   *
   * 需要特殊处理的是，this 或 this.x 无需向上查找（由 getter 函数处理）
   *
   * 此外，如果表达式是单向绑定或双向绑定，无需收集到模板依赖中（由 getter 函数处理）
   *
   */

  let keypath = char.CHAR_BLANK, keypaths = [ ], keypathStack = [ keypath ],

  pushKeypath = function (newKeypath) {
    array.push(keypaths, newKeypath)
    newKeypath = keypathUtil.stringify(keypaths)
    if (newKeypath !== keypath) {
      keypath = newKeypath
      keypathStack = object.copy(keypathStack)
      array.push(keypathStack, keypath)
    }
  },

  popKeypath = function (lastKeypath, lastKeypathStack) {
    keypaths.pop()
    keypath = lastKeypath
    keypathStack = lastKeypathStack
  },

  STRUCT = 'struct',

  // array
  a = function (arr) {
    arr[ STRUCT ] = env.TRUE
    return arr
  },

  toArray = function (arr) {
    let { length } = arr
    if (length > 0) {
      return length === 1
        ? arr[ 0 ]
        : a(arr)
    }
  },

  getRefKey = function (value) {
    return is.array(value) && value[ STRUCT ]
      ? array.join(value, '')
      : value
  },

  // create
  c = function (tag, attrs, props, childs, isComponent, ref, key) {

    // 处理属性
    let properties = { }, attributes = { }, directives = { }

    if (props || attrs) {

      let addDirective = function (name, modifier, value) {
        return directives[ keypathUtil.join(name, modifier) ] = {
          name,
          modifier,
          value,
          keypath,
          keypathStack,
        }
      }

      if (props) {
        object.each(
          props,
          function (value, key) {
            if (is.object(value)) {
              let { staticKeypath } = value
              value = getter(value, keypathStack, staticKeypath)
              if (staticKeypath) {
                addDirective(
                  config.DIRECTIVE_BINDING,
                  key,
                  staticKeypath
                ).prop = env.TRUE
              }
            }
            properties[ key ] = value
          }
        )
      }

      if (attrs) {
        let addAttr = function (item) {

          let { type, name, modifier, expr, children, binding } = item

          let value
          if (object.has(item, 'value')) {
            value = item.value
          }
          else if (expr) {
            value = getter(expr, keypathStack, binding)
          }
          else if (children) {
            value = array.join(children, '')
          }

          if (!isDef(value)) {
            if (expr || children) {
              value = char.CHAR_BLANK
            }
            else {
              value = isComponent ? env.TRUE : name
            }
          }

          if (type === nodeType.ATTRIBUTE) {
            attributes[ name ] = value
            if (binding) {
              addDirective(config.DIRECTIVE_BINDING, name, binding)
            }
          }
          else if (type === nodeType.DIRECTIVE) {
            addDirective(name, modifier, value).expr = expr
          }
          // 延展出来的数据
          else {
            object.extend(attributes, item)
          }

        }
        array.each(
          attrs,
          function (item) {
            if (item) {
              if (is.array(item)) {
                array.each(item, addAttr)
              }
              else {
                addAttr(item)
              }
            }
          }
        )
      }
    }


    // 处理 children
    let children = [ ], lastChild

    if (childs) {
      let addChild = function (child) {
        if (snabbdom.isVnode(child)) {
          if (child.component) {
            child.parent = instance
          }
          array.push(children, child)
          lastChild = env.NULL
        }
        else if (snabbdom.isTextVnode(lastChild)) {
          lastChild.text += toString(child)
        }
        else {
          lastChild = snabbdom.createTextVnode(child)
          array.push(children, lastChild)
        }
      }
      let eachChilds = function (childs) {
        array.each(
          childs,
          function (child) {
            if (child != env.NULL) {
              if (is.array(child) && child[ STRUCT ]) {
                eachChilds(child)
              }
              else {
                addChild(child)
              }
            }
          }
        )
      }
      eachChilds(childs)
    }

    // 创建元素/组件
    return snabbdom[ isComponent ? 'createComponentVnode' : 'createElementVnode' ](
      tag,
      attributes,
      properties,
      directives,
      children,
      getRefKey(ref),
      getRefKey(key),
      instance
    )
  },
  // comment
  m = snabbdom.createCommentVnode,
  // each
  e = function (expr, generate, index) {

    let each, value = getter(expr, keypathStack)

    if (is.array(value)) {
      each = array.each
    }
    else if (is.object(value)) {
      each = object.each
    }

    if (each) {
      let children = [ ], lastKeypath = keypath, lastKeypathStack = keypathStack

      let eachKeypath = expr.staticKeypath || expr.dynamicKeypath
      if (eachKeypath) {
        pushKeypath(eachKeypath)
      }

      each(
        value,
        function (item, i) {

          let lastKeypath = keypath, lastKeypathStack = keypathStack

          pushKeypath(i)

          setter(keypath, env.RAW_THIS, item)

          if (index) {
            setter(keypath, index, i)
          }

          array.each(
            generate(),
            function (item) {
              array.push(children, item)
            }
          )

          popKeypath(lastKeypath, lastKeypathStack)

        }
      )

      if (eachKeypath) {
        popKeypath(lastKeypath, lastKeypathStack)
      }

      return toArray(children)

    }
  },
  // output（e 被 each 占了..)
  o = function (expr) {
    return getter(expr, keypathStack)
  },
  // spread
  s = function (expr) {
    let value = getter(expr, keypathStack)
    return is.object(value)
      ? value
      : logger.fatal(`"${expr.raw}" spread expected to be an object.`)
  },
  localPartials = { },
  // partial
  p = function (name, children) {
    localPartials[ name ] = children
  },
  // import
  i = function (name) {
    let partial = localPartials[ name ] || instance.importPartial(name)
    if (partial) {
      return toArray(
        partial.map(
          function (item) {
            return is.func(item) ? item(a, c, m, e, o, s, p, i) : item
          }
        )
      )
    }
    logger.fatal(`"${name}" partial is not found.`)
  }

  return render(a, c, m, e, o, s, p, i)

}
