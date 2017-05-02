
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import executeFunction from 'yox-common/function/execute'
import executeExpression from 'yox-expression-compiler/execute'

import * as snabbdom from 'yox-snabbdom'

import Context from './src/Context'
import * as helper from './src/helper'
import * as syntax from './src/syntax'
import * as nodeType from './src/nodeType'

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Object} data 渲染模板的数据
 * @param {Yox} instance 组件实例
 * @return {Array}
 */
export default function render(ast, data, instance) {

  let keypath, keypathList = [ ],
  updateKeypath = function () {
    keypath = keypathUtil.stringify(keypathList)
  },
  getKeypath = function () {
    return keypath
  }

  updateKeypath()

  getKeypath.toString =
  data[ syntax.SPECIAL_KEYPATH ] = getKeypath

  let context = new Context(data, keypath), nodeStack = [ ], htmlStack = [ ], partials = { }, deps = { }
  let sibling, cache, prevCache, currentCache

  let isDefined = function (value) {
    return value !== env.UNDEFINED
  }

  let traverseList = function (list) {
    array.each(
      list,
      function (node, index) {
        if (!filterNode || filterNode(node)) {
          sibling = list[ index + 1 ]
          pushStack(node)
        }
      }
    )
  }

  let addChild = function (parent, child) {

    if (parent && isDefined(child)) {

      if (attributeRendering) {
        if (object.has(parent, 'value')) {
          parent.value += child
        }
        else {
          parent.value = child
        }
      }
      else {
        // 文本节点需要拼接
        // <div>123{{name}}456</div>
        // <div>123{{user}}456</div>

        let children = (parent.children || (parent.children = [ ]))
        let prevChild = array.last(children), prop = 'text'

        if (is.primitive(child) || !object.has(child, prop)) {
          if (is.object(prevChild) && is.string(prevChild[ prop ])) {
            prevChild[ prop ] += child
            return
          }
          else {
            child = snabbdom.createTextVnode(child)
          }
        }

        children.push(child)
      }

    }

  }

  let addAttr = function (parent, key, value) {
    let attrs = parent.attrs || (parent.attrs = { })
    attrs[ key ] = value
  }

  let addDirective = function (parent, name, modifier, value, expr) {
    let directives = parent.directives || (parent.directives = { })
    directives[ keypathUtil.join(name, modifier) ] = {
      name,
      modifier,
      context,
      keypath,
      value,
      expr,
    }
  }

  let getValue = function (source, output) {
    let value
    if (object.has(output, 'value')) {
      value = output.value
    }
    else if (source.expr) {
      value = executeExpr(source.expr, source.binding)
    }
    else if (object.has(source, 'value')) {
      value = source.value
    }
    if (value == env.NULL && (source.expr || source.children)) {
      value = char.CHAR_BLANK
    }
    return value
  }

  let attributeRendering
  let pushStack = function (source) {

    let { type, attrs, children } = source

    let parent = array.last(nodeStack), output = { type, source, parent }

    if (
      executeFunction(
        enter[ type ],
        env.NULL,
        [ source, output ]
      ) === env.FALSE
    ) {
      return
    }

    if (isDefined(source.keypath)) {
      array.push(
        keypathList,
        source.keypath
      )
      updateKeypath()
    }
    if (isDefined(source.forward)) {
      context = context.push(
        source.forward,
        keypath
      )
    }
    if (is.array(source.context)) {
      executeFunction(
        context.set,
        context,
        source.context
      )
    }

    array.push(nodeStack, output)

    if (helper.htmlTypes[ type ]) {
      array.push(htmlStack, output)
    }

    if (attrs) {
      attributeRendering = env.TRUE
      traverseList(attrs)
      attributeRendering = env.NULL
    }

    if (children) {
      traverseList(children)
    }

    executeFunction(
      leave[ type ],
      env.NULL,
      [ source, output ]
    )

    if (helper.htmlTypes[ source.type ]) {
      array.pop(htmlStack)
    }

    array.pop(nodeStack)

    if (isDefined(source.forward)) {
      context = context.pop()
    }
    if (isDefined(source.keypath)) {
      array.pop(keypathList)
      updateKeypath()
    }

    return output

  }

  let filterNode
  let filterElse = function (node) {
    if (helper.elseTypes[ node.type ]) {
      return env.FALSE
    }
    else {
      filterNode = env.NULL
      return env.TRUE
    }
  }

  // 缓存节点只处理一层，不支持下面这种多层缓存
  // <div key="{{xx}}">
  //     <div key="{{yy}}"></div>
  // </div>
  let cacheDeps

  let executeExpr = function (expr, filter) {
    return executeExpression(
      expr,
      function (key) {
        let { keypath, value } = context.get(key)
        if (!filter
          && !is.numeric(keypath)
          && !is.func(value)
          && key !== syntax.SPECIAL_EVENT
          && key !== syntax.SPECIAL_KEYPATH
        ) {
          deps[ keypath ] = value
          if (cacheDeps) {
            cacheDeps[ keypath ] = value
          }
          // 响应数组长度的变化是个很普遍的需求
          if (is.array(value)) {
            keypath = keypathUtil.join(keypath, 'length')
            deps[ keypath ] = value.length
            if (cacheDeps) {
              cacheDeps[ keypath ] = value
            }
          }
        }
        return value
      },
      instance
    )
  }

  let enter = { }, leave = { }

  enter[ nodeType.PARTIAL ] = function (source) {
    partials[ source.name ] = source.children
    return env.FALSE
  }

  enter[ nodeType.IMPORT ] = function (source) {
    let { name } = source
    let partial = partials[ name ] || instance.importPartial(name)
    if (partial) {
      if (is.array(partial)) {
        pushStack({
          children: partial,
        })
      }
      else {
        pushStack(partial)
      }
      return env.FALSE
    }
    logger.fatal(`Partial "${name}" is not found.`)
  }

  // 条件判断失败就没必要往下走了
  // 但如果失败的点原本是一个 DOM 元素
  // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
  enter[ nodeType.IF ] =
  enter[ nodeType.ELSE_IF ] = function (source) {
    if (!executeExpr(source.expr)) {
      if (sibling
        && !helper.elseTypes[ sibling.type ]
        && !attributeRendering
      ) {
        addChild(
          array.last(htmlStack),
          snabbdom.createCommentVnode()
        )
      }
      return env.FALSE
    }
  }

  leave[ nodeType.IF ] =
  leave[ nodeType.ELSE_IF ] =
  leave[ nodeType.ELSE ] = function (source, output) {
    filterNode = filterElse
    let { children } = output
    if (children) {
      let htmlNode = array.last(htmlStack)
      array.each(
        children,
        function (child) {
          addChild(htmlNode, child)
        }
      )
    }
  }

  enter[ nodeType.EACH ] = function (source) {

    let { expr, index, children } = source
    let forward = executeExpr(expr), each

    if (is.array(forward)) {
      each = array.each
    }
    else if (is.object(forward)) {
      each = object.each
    }

    if (each) {

      let list = [ ]

      each(
        forward,
        function (forward, i) {

          let child = {
            forward,
            children,
            keypath: i,
          }

          if (index) {
            child.context = [ index, i ]
          }

          array.push(list, child)

        }
      )

      pushStack({
        forward,
        children: list,
        keypath: expr.keypath,
      })

    }

    return env.FALSE

  }

  enter[ nodeType.ELEMENT ] = function (source, output) {
    let { key } = source
    if (key) {
      let trackBy
      if (is.string(key)) {
        trackBy = key
      }
      else if (is.array(key)) {
        attributeRendering = env.TRUE
        source = {
          type: nodeType.ATTRIBUTE,
          children: key,
        }
        trackBy = getValue(source, pushStack(source))
        attributeRendering = env.NULL
      }
      if (isDefined(trackBy)) {

        if (!currentCache) {
          prevCache = ast.cache || { }
          currentCache = ast.cache = { }
        }

        let cache = prevCache[ trackBy ]

        if (cache) {
          let isSame = env.TRUE
          object.each(
            cache.deps,
            function (oldValue, key) {
              let { value } = context.get(key)
              if (value === oldValue) {
                deps[ key ] = value
              }
              else {
                return isSame = env.FALSE
              }
            }
          )
          if (isSame) {
            currentCache[ trackBy ] = cache
            addChild(
              array.last(htmlStack),
              cache.vnode
            )
            return env.FALSE
          }
        }

        cacheDeps = { }
        output.key = trackBy

      }
    }
  }

  leave[ nodeType.ELEMENT ] = function (source, output) {

    let key, props
    if (object.has(output, 'key')) {
      key = output.key
    }

    if (source.props) {
      props = { }
      object.each(
        source.props,
        function (expr, key) {
          props[ key ] = executeExpr(expr)
        }
      )
    }

    let vnode = snabbdom.createElementVnode(
      source.name,
      {
        instance,
        props,
        attrs: output.attrs,
        directives: output.directives,
      },
      output.children,
      key,
      source.component
    )

    if (isDefined(key)) {
      currentCache[ key ] = {
        deps: cacheDeps,
        vnode,
      }
      cacheDeps = env.NULL
    }

    addChild(
      htmlStack[ htmlStack.length - 2 ],
      vnode
    )

  }



  leave[ nodeType.TEXT ] = function (source) {
    addChild(
      array.last(htmlStack),
      source.text
    )
  }

  leave[ nodeType.EXPRESSION ] = function (source) {
    addChild(
      array.last(htmlStack),
      executeExpr(source.expr)
    )
  }

  leave[ nodeType.ATTRIBUTE ] = function (source, output) {
    let element = htmlStack[ htmlStack.length - 2 ]
    let { name, binding } = source
    // key="xx" 是作为一个虚拟属性来求值的
    // 它并没有 name
    if (name) {
      addAttr(
        element,
        name,
        getValue(source, output)
      )
      if (binding) {
        addDirective(
          element,
          syntax.DIRECTIVE_MODEL,
          name,
          binding
        )
      }
    }
  }

  leave[ nodeType.DIRECTIVE ] = function (source, output) {

    // 1.如果指令的值是纯文本，会在编译阶段转成表达式抽象语法树
    //   on-click="submit()"
    //   ref="child"
    //
    // 2.如果指令的值包含插值语法，则会 merge 出最终值
    //   on-click="haha{{name}}"
    //
    // model="xxx"
    // model=""

    addDirective(
      htmlStack[ htmlStack.length - 2 ],
      source.name,
      source.modifier,
      getValue(source, output),
      source.expr
    )

  }

  leave[ nodeType.SPREAD ] = function (source, output) {

    // 1. <Component {{...props}} />
    //    把 props.xx 当做单向绑定指令，无需收集依赖
    //
    // 2. <Component {{... a ? aProps : bProps }}/>
    //    复杂的表达式，需要收集依赖

    let expr = source.expr, hasKeypath = is.string(expr.keypath), value = executeExpr(expr, hasKeypath)

    if (is.object(value)) {
      let element = array.last(htmlStack)
      object.each(
        value,
        function (value, name) {
          addAttr(
            element,
            name,
            value
          )
          if (hasKeypath) {
            addDirective(
              element,
              syntax.DIRECTIVE_MODEL,
              name,
              keypathUtil.join(expr.keypath, name)
            )
          }
        }
      )
    }
    else {
      logger.fatal(`Spread "${expr.source}" expected to be an object.`)
    }

  }

  let result = pushStack({
    type: nodeType.ELEMENT,
    children: is.array(ast) ? ast : [ ast ]
  })

  return {
    nodes: result.children,
    deps,
  }

}
