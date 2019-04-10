import toJSON from 'yox-common/function/toJSON'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'

import * as config from 'yox-config'

import * as nodeType from './nodeType'

import Node from './node/Node'
import Text from './node/Text'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Else from './node/Else'
import Element from './node/Element';
import Attribute from './node/Attribute';
import Expression from './node/Expression';
import Import from './node/Import';
import Partial from './node/Partial';
import Spread from './node/Spread';

function stringifyObject() {}
function stringifyArray(arr, name): string {
  if (arr && arr.length) {
    let result = arr.map(
      function (item) {
        if (item.stringify) {
          return item.stringify()
        }
        if (is.string(item)) {
          return toJSON(item)
        }
        if (is.object(item)) {
          return stringifyObject(item)
        }
        return item
      }
    )
    return name
      ? stringifyCall(name, result)
      : `[${array.join(result, char.CHAR_COMMA)}]`
  }
}

function stringifyExpression(expr: Object): string {
  return stringifyCall('_s', toJSON(expr))
}

function stringifyCall(name: string, params: any[]): string {
  return `${name}(${is.array(params) ? array.join(params, char.CHAR_COMMA) : params})`
}

function stringifyFunction(str) {
  return `${env.RAW_FUNCTION}(){${str || char.CHAR_BLANK}}`
}

const nodeStringify = {}

nodeStringify[nodeType.TEXT] = function (node: Text): string {
  return toJSON(node.text)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyExpression(node.expr)
}

// nodeStringify[nodeType.ATTRIBUTE] = function (node: Attribute): string {
//   stringifyObject
// }

// nodeStringify[nodeType.DIRECTIVE] = function (node: Node) {
//   let generate = stringifyArray(node.children, 'x')
//   if (generate) {
//     let params = [
//       toJSON(this[env.RAW_EXPR]),
//       stringifyFunction(generate)
//     ]
//     if (this[env.RAW_INDEX]) {
//       array.push(
//         params,
//         toJSON(this[env.RAW_INDEX])
//       )
//     }
//     return stringifyFunction(
//       stringifyCall('e', params)
//     )
//   }
// }

// stringify[nodeType.IF] = function (node: If): string {

//   let { stump } = node

//   let stringify = function (node: If | ElseIf) {
//     let expr = stringifyExpression(node.expr)
//     let children = stringifyArray(node.children, 'x')
//     let next = node.next
//     if (next) {
//       next = stringify(next)
//     }
//     else if (stump) {
//       next = 'x(m())'
//     }
//     if (expr) {
//       if (children) {
//         return next
//           ? `${expr} ? ${children} : ${next}`
//           : `${expr} && ${children}`
//       }
//       else if (next) {
//         return `!${expr} && ${next}`
//       }
//     }
//     else if (children) {
//       return children
//     }
//   }

//   let str = stringify(node)
//   if (str) {
//     return stringifyFunction(str)
//   }
// }

// nodeStringify[nodeType.IMPORT] = function (node: Import): string {
//   return stringifyCall(
//     '_i',
//     toJSON(node.name)
//   )
// }

// nodeStringify[nodeType.PARTIAL] = function (node: Partial): string {
//   return stringifyCall(
//     '_p',
//     [
//       toJSON(node.name),
//       stringifyFunction(
//         stringifyArray(node.children, 'x')
//       )
//     ]
//   )
// }

// stringify[nodeType.SPREAD] = function (node: Spread): string {
//   return stringifyCall(
//     '_s',
//     toJSON(node.expr)
//   )
// }

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, component, props, attrs, children } = node

  let args: any[] = [ toJSON(tag) ], data: any = { }, childs = [ ]

  if (component) {

    data.component = component

    let componentProps = {}

    if (attrs) {
      array.each(
        attrs,
        function (attr) {
          if (attr.directive) {

          }
          else {
            componentProps[attr.name] = attr.value
          }
        }
      )
    }

    // 目前只可能存在两个属性：text 和 html
    if (props) {
      array.each(
        props,
        function (prop) {
          componentProps[prop.name] = prop.value
        }
      )
    }

    if (object.keys(componentProps).length) {
      data.props = componentProps
    }

  }
  else {
    if (attrs) {
      let nativeAttrs = {}, nativeOn = {}, directives = []
      array.each(
        attrs,
        function (attr) {
          if (attr.directive) {
            if (attr.namespace === config.DIRECTIVE_EVENT) {
              nativeOn[attr.name] = attr.expr
            }
            else {
              array.push(
                directives,
                {
                  name: attr.name,
                  value: attr.value,
                  expr: attr.expr,
                }
              )
            }
          }
          else {
            nativeAttrs[attr.name] = attr.value
          }
        }
      )
      if (!object.empty(nativeAttrs)) {
        data.nativeAttrs = nativeAttrs
      }
      if (!object.empty(nativeOn)) {
        data.nativeOn = nativeOn
      }
      if (directives.length) {
        data.directives = directives
      }
    }

    // 目前只可能存在两个属性：text 和 html
    if (props) {
      let nativeProps = {}
      array.each(
        props,
        function (prop) {
          nativeProps[prop.name === 'text' ? 'textContent' : 'innerHTML'] = prop.value
        }
      )
      data.nativeProps = nativeProps
    }
  }

  if (!object.empty(data)) {
    array.push(args, toJSON(data))
  }

  if (childs.length) {
    args.push(toJSON(childs))
  }

  return stringifyCall('_c', args)

}

export function stringify(node: Node): string {
  return nodeStringify[node.type](node)
}