
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

import * as expressionCompiler from 'yox-expression-compiler'

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
  return string.trim(string.slice(str, prefix[ env.RAW_LENGTH ]))
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
      && lastNode.tag !== popingTagName
      && array.has(selfClosingTagNames, lastNode.tag)
    ) {
      popStack(
        nodeType.ELEMENT,
        lastNode.tag
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

      let { tag, name, divider, children, component } = target
      if (type === nodeType.ELEMENT && expectedTagName && tag !== expectedTagName) {
        throwError(`end tag expected </${tag}> to be </${expectedTagName}>.`)
      }

      // ==========================================
      // 以下是性能优化的逻辑
      // ==========================================

      // 如果 children 没实际的数据，删掉它
      // 避免在渲染阶段增加计算量
      if (children && !children[ env.RAW_LENGTH ]) {
        children = env.NULL
        delete target.children
      }

      if (!children) {
        return
      }

      if (type === nodeType.ELEMENT) {
        // 优化只有一个子节点的情况
        if (!component
          && tag !== 'template'
          && children[ env.RAW_LENGTH ] - divider === 1
        ) {

          let singleChild = array.last(children)

          // 子节点是纯文本
          if (singleChild.type === nodeType.TEXT) {
            target.props = [
              {
                name: 'textContent',
                value: singleChild.text,
              }
            ]
            array.pop(children)
          }
          else if (singleChild.type === nodeType.EXPRESSION) {
            let props = [ ]
            if (singleChild.safe === env.FALSE) {
              array.push(
                props,
                {
                  name: 'innerHTML',
                  value: singleChild.expr,
                }
              )
            }
            else {
              array.push(
                props,
                {
                  name: 'textContent',
                  value: singleChild.expr,
                }
              )
            }
            target.props = props
            array.pop(children)
          }

          if (!children[ env.RAW_LENGTH ]) {
            delete target.children
          }

        }
      }
      else {

        if (type === nodeType.ATTRIBUTE) {
          // <div key="xx">
          // <div ref="xx">
          // <slot name="xx">
          let element = array.last(htmlStack)
          if (name === 'key'
            || name === 'ref'
            || (element.tag === 'template' && name === 'slot')
            || (element.tag === 'slot' && name === 'name')
          ) {
            // 把数据从属性中提出来，减少渲染时的遍历
            array.remove(element.children, target)
            if (!element.children[ env.RAW_LENGTH ]) {
              delete element.children
            }
            if (children[ env.RAW_LENGTH ]) {
              element[ name ] = children
            }
            return
          }
        }

        let singleChild = children[ env.RAW_LENGTH ] === 1 && children[ 0 ]
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
    if (!htmlStack[ env.RAW_LENGTH ]) {
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
        if (children[ env.RAW_LENGTH ] !== divider) {
          prevNode = children[ children[ env.RAW_LENGTH ] - 1 ]
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
      && !htmlStack[ env.RAW_LENGTH ]
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
      if (!htmlStack[ env.RAW_LENGTH ]) {
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
        if (htmlStack[ env.RAW_LENGTH ] === 1) {
          let element = array.last(htmlStack)
          element.divider = element.children ? element.children[ env.RAW_LENGTH ] : 0
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
      if (htmlStack[ env.RAW_LENGTH ] === 1) {
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
            name = string.slice(name, config.DIRECTIVE_EVENT_PREFIX[ env.RAW_LENGTH ])
            addChild(
              new Directive(
                config.DIRECTIVE_EVENT,
                string.camelCase(name)
              )
            )
          }
          else if (string.startsWith(name, config.DIRECTIVE_CUSTOM_PREFIX)) {
            name = string.slice(name, config.DIRECTIVE_CUSTOM_PREFIX[ env.RAW_LENGTH ])
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
      if (htmlStack[ env.RAW_LENGTH ] === 2) {
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
        if (htmlStack[ env.RAW_LENGTH ] !== 1
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
        source = slicePrefix(source, config.SYNTAX_EACH)
        let terms = source.replace(/\s+/g, char.CHAR_BLANK).split(char.CHAR_COLON)
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
              tpl = string.slice(tpl, match[ env.RAW_LENGTH ])
              return env.FALSE
            }
          }
        )
      }
      str = string.slice(str, content[ env.RAW_LENGTH ])
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
    str = string.slice(str, all[ env.RAW_LENGTH ])
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
      if (match[ 1 ][ env.RAW_LENGTH ] === match[ 3 ][ env.RAW_LENGTH ]) {
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
      return new Function('a', 'b', 'c', 'e', 'i', 'm', 'o', 'p', 's', 'x', 'y', 'z', `return ${item.stringify()}`)
    }
  )
}


const SLOT_PREFIX = '$slot_'

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
    newKeypath = array.join(keypaths, env.KEYPATH_SEPARATOR)
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

  values,

  currentElement,
  elementStack = [ ],

  pushElement = function (element) {
    currentElement = element
    array.push(
      elementStack,
      element
    )
  },

  popElement = function (lastElement) {
    currentElement = lastElement
    array.pop(elementStack)
  },

  currentComponent,
  componentStack = [ ],

  pushComponent = function (component) {
    currentComponent = component
    array.push(
      componentStack,
      component
    )
  },

  popComponent = function (lastComponent) {
    currentComponent = lastComponent
    array.pop(componentStack)
  },

  addAttr = function (name, value) {
    let attrs = currentElement.attrs || (currentElement.attrs = { })
    attrs[ name ] = value
  },

  addDirective = function (name, modifier, value) {
    let directives = currentElement.directives || (currentElement.directives = { })
    return directives[ keypathUtil.join(name, modifier) ] = {
      name,
      modifier,
      value,
      keypath,
      keypathStack,
    }
  },

  addChild = function (node) {

    let { lastChild, children } = currentElement
    if (!children) {
      children = currentElement.children = [ ]
    }

    if (snabbdom.isVnode(node)) {
      if (node.component) {
        node.parent = instance
      }
      array.push(children, node)
      if (lastChild) {
        currentElement.lastChild = env.NULL
      }
    }
    else if (snabbdom.isTextVnode(lastChild)) {
      lastChild.text += toString(node)
    }
    else {
      array.push(
        children,
        currentElement.lastChild = snabbdom.createTextVnode(node)
      )
    }

  },

  addSlot = function (name, slot) {
    let slots = currentComponent.slots || (currentComponent.slots = { })
    if (slots[ name ]) {
      array.push(
        slots[ name ],
        slot
      )
    }
    else {
      slots[ name ] = slot
    }
  },

  attrHandler = function (node) {
    if (isDef(node)) {
      if (is.func(node)) {
        node()
      }
      else if (node.type === nodeType.ATTRIBUTE) {
        let value
        if (object.has(node, 'value')) {
          value = node.value
        }
        else if (node.expr) {
          let { expr } = node
          value = o(expr, expr.staticKeypath)
          if (expr.staticKeypath) {
            addDirective(
              config.DIRECTIVE_BINDING,
              name,
              expr.actualKeypath
            )
          }
        }
        else if (node.children) {
          value = getValue(node.children)
        }
        else {
          value = currentElement.component ? env.TRUE : node.name
        }
        addAttr(node.name, value)
      }
      else {
        let { expr } = node
        if (expr) {
          // 求值会给 expr 加上 actualKeypath
          o(expr)
        }
        addDirective(
          node.name,
          node.modifier,
          node.name === config.DIRECTIVE_MODEL
          ? expr.actualKeypath
          : node.value
        ).expr = expr
      }
    }
  },

  childHandler = function (node) {
    if (isDef(node)) {
      if (is.func(node)) {
        node()
      }
      else if (values) {
        values[ values[ env.RAW_LENGTH ] ] = node
      }
      else if (currentElement.opened === env.TRUE) {

        if (is.array(node)) {
          array.each(
            node,
            addChild
          )
        }
        else {
          addChild(node)
        }

      }
      else {
        attrHandler(node)
      }
    }
  },

  getValue = function (generate) {
    values = [ ]
    generate()
    let value = values[ env.RAW_LENGTH ] > 1
      ? array.join(values, '')
      : values[ 0 ]
    values = env.NULL
    return value
  },

  // 处理 children
  x = function () {
    array.each(
      arguments,
      childHandler
    )
  },

  // 处理元素 attribute
  y = function () {
    array.each(
      arguments,
      attrHandler
    )
  },

  // 处理 properties
  z = function () {
    object.each(
      arguments,
      function (item) {
        let { name, value } = item
        if (is.object(value)) {
          let expr = value
          value = o(expr, expr.staticKeypath)
          if (expr.staticKeypath) {
            addDirective(
              config.DIRECTIVE_BINDING,
              name,
              expr.actualKeypath
            ).prop = env.TRUE
          }
        }
        let props = currentElement.props || (currentElement.props = { })
        props[ name ] = value
      }
    )
  },

  // template
  a = function (name, childs) {

    if (currentComponent && (name = getValue(name))) {

      let lastElement = currentElement

      pushElement({
        opened: env.TRUE,
      })

      childs()

      addSlot(
        SLOT_PREFIX + name,
        currentElement.children
      )

      popElement(lastElement)

    }

  },
  // slot
  b = function (name) {
    name = getValue(name)
    if (name) {
      let result = getter(SLOT_PREFIX + name)
      return is.array(result) && result.length === 1
        ? result[ 0 ]
        : result
    }
  },

  // create
  c = function (component, tag, props, attrs, childs, ref, key) {

    let lastElement = currentElement, lastComponent = currentComponent

    pushElement({
      component,
    })

    if (component) {
      pushComponent(currentElement)
    }

    if (key) {
      key = getValue(key)
    }

    if (ref) {
      ref = getValue(ref)
    }

    if (attrs) {
      attrs()
    }

    if (props) {
      props()
    }

    let children
    if (childs) {
      currentElement.opened = env.TRUE
      childs()
      children = currentElement.children
      if (component) {
        addSlot(
          SLOT_PREFIX + 'children',
          children || [ ]
        )
        if (children) {
          children = env.UNDEFINED
        }
      }
    }

    let result = snabbdom[ component ? 'createComponentVnode' : 'createElementVnode' ](
      tag,
      currentElement.attrs,
      currentElement.props,
      currentElement.directives,
      children,
      currentElement.slots,
      ref,
      key,
      instance
    )

    popElement(lastElement)

    if (component) {
      popComponent(lastComponent)
    }

    return result

  },
  // comment
  m = snabbdom.createCommentVnode,
  // each
  e = function (expr, generate, index) {

    let value = o(expr), each

    if (is.array(value)) {
      each = array.each
    }
    else if (is.object(value)) {
      each = object.each
    }

    if (each) {
      let lastKeypath = keypath, lastKeypathStack = keypathStack

      let eachKeypath = expr.staticKeypath || expr.dynamicKeypath
      if (eachKeypath) {
        pushKeypath(eachKeypath)
      }

      each(
        value,
        function (item, key) {

          let lastKeypath = keypath, lastKeypathStack = keypathStack

          pushKeypath(key)

          setter(keypath, env.RAW_THIS, item)

          if (index) {
            setter(keypath, index, key)
          }

          generate()

          popKeypath(lastKeypath, lastKeypathStack)

        }
      )

      if (eachKeypath) {
        popKeypath(lastKeypath, lastKeypathStack)
      }

    }
  },
  // output（e 被 each 占了..)
  o = function (expr, binding) {
    return getter(expr, keypathStack, binding)
  },
  // spread
  s = function (expr) {
    let { staticKeypath } = expr, value
    // 只能作用于 attribute 层级
    if (currentElement.opened !== env.TRUE
      && (value = o(expr, staticKeypath))
      && is.object(value)
    ) {
      let { actualKeypath } = expr
      object.each(
        value,
        function (value, key) {
          addAttr(key, value)
          if (isDef(staticKeypath)) {
            addDirective(
              config.DIRECTIVE_BINDING,
              key,
              actualKeypath
              ? actualKeypath + env.KEYPATH_SEPARATOR + key
              : key
            )
          }
        }
      )
    }
  },
  localPartials = { },
  // partial
  p = function (name, children) {
    localPartials[ name ] = children
  },
  // import
  i = function (name) {
    if (localPartials[ name ]) {
      localPartials[ name ]()
      return
    }
    let partial = instance.importPartial(name)
    if (partial) {
      array.each(
        partial,
        executeRender
      )
      return
    }
    logger.fatal(`"${name}" partial is not found.`)
  },
  executeRender = function (render) {
    return render(a, b, c, e, i, m, o, p, s, x, y, z)
  }

  return executeRender(render)

}
