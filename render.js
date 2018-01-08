
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import isDef from 'yox-common/function/isDef'
import toString from 'yox-common/function/toString'
import executeFunction from 'yox-common/function/execute'
import executeExpression from 'yox-expression-compiler/execute'

import * as config from 'yox-config'
import * as snabbdom from 'yox-snabbdom'

import Context from './src/Context'
import * as helper from './src/helper'
import * as nodeType from './src/nodeType'

const TEXT = 'text'
const VALUE = 'value'

/**
 * 渲染抽象语法树
 *
 * @param {Object} ast 编译出来的抽象语法树
 * @param {Object} data 渲染模板的数据
 * @param {Yox} instance 组件实例
 * @return {Object}
 */
export default function render(ast, data, instance) {

  // 为了减少字符，一个 let 定义完所有变量
  // 这里不考虑是否一行过长
  let keypath = char.CHAR_BLANK, keypathList = [ ], context = new Context(data, keypath), nodeStack = [ ], htmlStack = [ ], partials = { }, deps = { }, enter = { }, leave = { }, cache, prevCache, currentCache, cacheDeps

  let updateKeypath = function () {
    keypath = keypathUtil.stringify(keypathList)
  }

  let addChild = function (parent, child) {

    if (parent && isDef(child)) {

      if (parent.type === nodeType.ELEMENT) {

        let children = (parent.children || (parent.children = [ ]))
        let prevChild = array.last(children)

        if (is.array(child)) {
          array.each(
            child,
            function (item) {
              if (object.has(item, TEXT)) {
                item.parent = instance
                children.push(item)
              }
            }
          )
        }
        else if (is.object(child)) {
          if (object.has(child, TEXT)) {
            children.push(child)
          }
        }
        else {
          if (snabbdom.isTextVnode(prevChild)) {
            prevChild[ TEXT ] += toString(child)
          }
          else {
            children.push(
              snabbdom.createTextVnode(child)
            )
          }
        }

      }
      else {
        if (object.has(parent, VALUE)) {
          parent.value += child
        }
        else {
          parent.value = child
        }
      }

    }

  }

  let addAttr = function (parent, key, value) {
    let attrs = parent.attrs || (parent.attrs = { })
    attrs[ key ] = value
  }

  let addDirective = function (parent, name, modifier, value) {
    let directives = parent.directives || (parent.directives = { })
    return directives[ keypathUtil.join(name, modifier) ] = {
      name,
      modifier,
      context,
      keypath,
      value,
    }
  }

  let getValue = function (element, source, output) {
    let value
    if (object.has(output, VALUE)) {
      value = output.value
    }
    else if (object.has(source, VALUE)) {
      value = source.value
    }
    else if (source.expr) {
      value = executeExpr(source.expr, source.binding || source.type === nodeType.DIRECTIVE)
    }
    if (!isDef(value)) {
      if (source.expr || source.children) {
        value = char.CHAR_BLANK
      }
      else if (element.component) {
        value = env.TRUE
      }
      else {
        value = source.name
      }
    }
    return value
  }

  let pushStack = function (source) {

    let { type, children } = source

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

    array.push(nodeStack, output)

    if (helper.htmlTypes[ type ]) {
      array.push(htmlStack, output)
    }

    if (children) {
      array.each(
        children,
        function (node, index) {
          pushStack(node)
        }
      )
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

    return output

  }

  // 缓存节点只处理一层，不支持下面这种多层缓存
  // <div key="{{xx}}">
  //     <div key="{{yy}}"></div>
  // </div>

  let executeExpr = function (expr, filter) {
    return executeExpression(
      expr,
      function (key) {
        let { keypath, value, temp } = context.get(key)
        if (!filter && !temp) {
          deps[ keypath ] = value
          if (cacheDeps) {
            cacheDeps[ key ] = value
          }
        }
        return value
      },
      instance
    )
  }

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
    logger.fatal(`"${name}" partial is not found.`)
  }

  // 条件判断失败就没必要往下走了
  // 但如果失败的点原本是一个 DOM 元素
  // 就需要用注释节点来占位，否则 virtual dom 无法正常工作
  enter[ nodeType.IF ] = function (source) {
    let { stump } = source
    while (env.TRUE) {
      // 有判断条件
      if (source.expr) {
        if (executeExpr(source.expr)) {
          pushStack({
            children: source.children,
          })
          break
        }
        else {
          if (source.next) {
            source = source.next
          }
          else {
            if (stump) {
              addChild(
                array.last(htmlStack),
                snabbdom.createCommentVnode()
              )
            }
            break
          }
        }
      }
      // 无判断条件，即 else
      else {
        pushStack({
          children: source.children,
        })
        break
      }
    }
    return env.FALSE
  }

  enter[ nodeType.EACH ] = function (source) {

    let { expr, index, children } = source
    let value = executeExpr(expr), each

    if (is.array(value)) {
      each = array.each
    }
    else if (is.object(value)) {
      each = object.each
    }

    if (each) {

      let eachKeypath = expr.keypath
      if (isDef(eachKeypath)) {
        array.push(keypathList, eachKeypath)
        updateKeypath()
      }
      context = context.push(value, keypath)

      each(
        value,
        function (value, i) {

          array.push(keypathList, i)
          updateKeypath()

          context = context.push(value, keypath)
          if (index) {
            context.set(index, i)
          }

          pushStack({
            children,
          })

          context = context.pop()
          array.pop(keypathList)
          updateKeypath()

        }
      )

      context = context.pop()
      if (isDef(eachKeypath)) {
        array.pop(keypathList)
        updateKeypath()
      }

    }

    return env.FALSE

  }

  let getKeywordValue = function (value) {
    if (is.string(value)) {
      return value
    }
    else if (is.object(value)) {
      return executeExpr(value)
    }
  }

  enter[ nodeType.ELEMENT ] = function (source, output) {
    let { name, key, ref } = source
    if (key) {
      let trackBy = getKeywordValue(key)
      if (isDef(trackBy)) {

        if (!currentCache) {
          prevCache = instance.$templateCache || { }
          currentCache = instance.$templateCache = { }
        }

        let cache = prevCache[ trackBy ]

        if (cache) {
          let isSame = cache.keypath === keypath
          if (isSame) {
            object.each(
              cache.deps,
              function (oldValue, key) {
                let { keypath, value } = context.get(key)
                if (value === oldValue) {
                  deps[ keypath ] = value
                }
                else {
                  return isSame = env.FALSE
                }
              }
            )
          }
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
        currentCache[ trackBy ] = {
          keypath,
        }
      }
    }
    if (ref) {
      output.ref = getKeywordValue(ref)
    }
  }

  leave[ nodeType.ELEMENT ] = function (source, output) {

    let { component } = source, { key, ref, attrs, children } = output, props, vnode, create

    if (source.props) {
      props = { }
      object.each(
        source.props,
        function (expr, key) {
          let value
          if (is.primitive(expr)) {
            value = expr
          }
          else {
            let { keypath } = expr
            value = executeExpr(expr, keypath)
            if (keypath) {
              addDirective(
                output,
                config.DIRECTIVE_BINDING,
                key,
                keypath
              ).prop = env.TRUE
            }
          }
          props[ key ] = value
        }
      )
    }

    if (component) {
      create = 'createComponentVnode'
      if (children) {
        if (!attrs) {
          attrs = { }
        }
        attrs[ config.SPECIAL_CHILDREN ] = children
        children = env.UNDEFINED
      }
    }
    else {
      create = 'createElementVnode'
    }

    vnode = snabbdom[ create ](
      source.name,
      attrs,
      props,
      output.directives,
      children,
      key,
      ref,
      instance
    )

    if (isDef(key)) {
      currentCache[ key ].deps = cacheDeps
      currentCache[ key ].vnode = vnode
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
    addAttr(
      element,
      name,
      getValue(element, source, output)
    )
    if (binding) {
      addDirective(
        element,
        config.DIRECTIVE_BINDING,
        name,
        binding
      )
    }
  }

  leave[ nodeType.DIRECTIVE ] = function (source, output) {

    // 1.如果指令的值是纯文本，会在编译阶段转成表达式抽象语法树
    //   on-click="submit()"
    //   ref="child"
    //
    // 2.如果指令的值包含插值语法，则会拼接出最终值
    //   on-click="haha{{name}}"

    let element = htmlStack[ htmlStack.length - 2 ]

    addDirective(
      element,
      source.name,
      source.modifier,
      getValue(element, source, output)
    ).expr = source.expr

  }

  leave[ nodeType.SPREAD ] = function (source, output) {

    // 1. <Component {{...props}} />
    //    把 props.xx 当做单向绑定指令，无需收集依赖
    //
    // 2. <Component {{... a ? aProps : bProps }}/>
    //    复杂的表达式，需要收集依赖

    let expr = source.expr, spreadKeypath = expr.keypath, value = executeExpr(expr, spreadKeypath)

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
          if (spreadKeypath) {
            addDirective(
              element,
              config.DIRECTIVE_BINDING,
              name,
              keypathUtil.join(spreadKeypath, name)
            )
          }
        }
      )
    }
    else {
      logger.fatal(`"${expr.raw}" spread expected to be an object.`)
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
