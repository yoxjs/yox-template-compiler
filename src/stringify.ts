
import * as nodeType from './nodeType'
import * as helper from './helper'

const stringify = {}

stringify[nodeType.ATTRIBUTE] = helper.stringifyObject
stringify[nodeType.DIRECTIVE] = helper.stringifyObject
stringify[nodeType.DIRECTIVE] = function (node: Node) {
  let generate = helper.stringifyArray(node[env.RAW_CHILDREN], 'x')
  if (generate) {
    let params = [
      stringifyJSON(this[env.RAW_EXPR]),
      helper.stringifyFunction(generate)
    ]
    if (this[env.RAW_INDEX]) {
      array.push(
        params,
        stringifyJSON(this[env.RAW_INDEX])
      )
    }
    return helper.stringifyFunction(
      helper.stringifyCall('e', params)
    )
  }
}
stringify[nodeType.EXPRESSION] = function (node) {
  return helper.stringifyExpression(node.expr)
}
stringify[nodeType.IF] = function (node) {
  let { stump } = node

  let stringify = function (node) {
    let expr = helper.stringifyExpression(node[env.RAW_EXPR])
    let children = helper.stringifyArray(node[env.RAW_CHILDREN], 'x')
    let next = node.next
    if (next) {
      next = stringify(next)
    }
    else if (stump) {
      next = 'x(m())'
    }
    if (expr) {
      if (children) {
        return next
          ? `${expr}?${children}:${next}`
          : `${expr}&&${children}`
      }
      else if (next) {
        return `!${expr}&&${next}`
      }
    }
    else if (children) {
      return children
    }
  }

  let str = stringify(this)
  if (str) {
    return helper.stringifyFunction(str)
  }
}
stringify[nodeType.ELSE] = helper.stringifyObject
stringify[nodeType.ELSE_IF] = helper.stringifyObject
stringify[nodeType.IMPORT] = function (node) {
  return helper.stringifyCall(
    'i',
    stringifyJSON(node[env.RAW_NAME])
  )
}
stringify[nodeType.PARTIAL] = function (node) {
  return helper.stringifyCall(
    'p',
    [
      stringifyJSON(this[env.RAW_NAME]),
      helper.stringifyFunction(
        helper.stringifyArray(this[env.RAW_CHILDREN], 'x')
      )
    ]
  )
}
stringify[nodeType.SPREAD] = function (node) {
  return helper.stringifyCall(
    's',
    stringifyJSON(this[env.RAW_EXPR])
  )
}
stringify[nodeType.TEXT] = function (node) {
  stringifyJSON(this[env.RAW_TEXT])
}
stringify[nodeType.ELEMENT] = function (node) {
  let me = this
  let { tag, divider, component, props, slot, name, key, ref, transition } = me

  let params = [], attrs = [], children = []

  if (me[env.RAW_CHILDREN]) {
    array.each(
      me[env.RAW_CHILDREN],
      function (child, index) {
        array.push(
          index < divider ? attrs : children,
          child
        )
      }
    )
  }

  let addParam = function (arr, name) {
    arr = helper.stringifyArray(arr, name || 'x')
    array.unshift(
      params,
      arr
        ? helper.stringifyFunction(arr)
        : env.RAW_UNDEFINED
    )
  }

  if (tag === env.RAW_TEMPLATE) {
    if (slot && children[env.RAW_LENGTH]) {
      addParam(children)
      addParam(slot)
      return helper.stringifyCall('a', params)
    }
  }
  else if (tag === env.RAW_SLOT) {
    if (name) {
      addParam(name)
      return helper.stringifyCall('b', params)
    }
  }
  else {

    if (key) {
      addParam(key)
    }

    if (transition || params[env.RAW_LENGTH]) {
      addParam(transition)
    }

    if (ref || params[env.RAW_LENGTH]) {
      addParam(ref)
    }

    if (props && props[env.RAW_LENGTH] || params[env.RAW_LENGTH]) {
      addParam(props, 'z')
    }

    if (attrs[env.RAW_LENGTH] || params[env.RAW_LENGTH]) {
      addParam(attrs, 'y')
    }

    if (children[env.RAW_LENGTH] || params[env.RAW_LENGTH]) {
      addParam(children)
    }

    array.unshift(params, stringifyJSON(tag))
    array.unshift(params, component ? 1 : 0)

    return helper.stringifyCall('c', params)

  }
}

export function stringify(node): string {
  return stringify[node.type](node)
}