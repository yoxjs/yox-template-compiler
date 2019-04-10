import isDef from 'yox-common/function/isDef'
import toJSON from 'yox-common/function/toJSON'
import toString from 'yox-common/function/toString'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as string from 'yox-common/util/string'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

import * as config from 'yox-config'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

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
import Pair from './node/Pair';


function stringifyObject(obj: Object): string | void {
  const fields = []
  object.each(
    obj,
    function (value: any, key: string) {
      if (isDef(value)) {
        array.push(
          fields,
          `${toJSON(key)}: ${value}`
        )
      }
    }
  )
  if (fields.length) {
    return `{ ${array.join(fields, ', ')} }`
  }
}

function stringifyArray(arr: any[]): string | void {
  if (arr.length) {
    return `[ ${array.join(arr, ', ')} ]`
  }
}

function stringifyCall(name: string, args?: any[]): string {
  const tuple = args
    ? array.join(args, ', ')
    : char.CHAR_BLANK
  return `${name}(${tuple})`
}

const nodeStringify = {}

nodeStringify[nodeType.TEXT] = function (node: Text): string {
  return toJSON(node.text)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyCall('_s', [toJSON(node.expr)])
}

function stringifyEvent(expr: ExpressionNode): any {
  if (expr.type === exprNodeType.IDENTIFIER) {
    return stringifyObject({
      event: toJSON((expr as ExpressionIdentifier).name)
    })
  }
  else if (expr.type === exprNodeType.CALL) {
    const { callee, args } = expr as ExpressionCall
    if (callee.type === exprNodeType.IDENTIFIER) {
      return stringifyObject({
        method: toJSON((callee as ExpressionIdentifier).name),
        args: args.length > 0
          ? toJSON(args)
          : env.UNDEFINED,
      })
    }
  }
}

function stringifyDirective(name: string, value: string, expr: ExpressionNode): string | void {
  return stringifyObject({
    name: toJSON(name),
    value: toJSON(value),
    expr: toJSON(expr),
  })
}

function stringifyChildren(children: Node[] | void): string | void {
  if (children) {
    return stringifyArray(
      children.map(stringify)
    )
  }
}

function stringifyComponentData(attrs: Attribute[] | void, props: Pair[] | void): Object {

  const data: any = {
    component: env.TRUE,
  },

  componentProps = {},

  componentOn = {},

  componentDirectives = {}

  if (attrs) {
    array.each(
      attrs,
      function (attr) {
        if (attr.directive) {
          if (attr.namespace === config.DIRECTIVE_EVENT) {
            componentOn[attr.name] = stringifyEvent(attr.expr)
          }
          else {
            componentDirectives[attr.name] = stringifyDirective(attr.name, attr.value, attr.expr)
          }
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

  if (!object.empty(componentProps)) {
    data.props = componentProps
  }

  if (!object.empty(componentOn)) {
    data.on = componentOn
  }

  if (!object.empty(componentDirectives)) {
    data.directives = componentDirectives
  }

  return data

}

function stringifyElementData(attrs: Attribute[] | void, props: Pair[] | void): string | void {

  const data: any = {},

  nativeAttrs = {},

  nativeProps = {},

  nativeOn = {},

  nativeDirectives = {}

  if (attrs) {
    array.each(
      attrs,
      function (attr) {
        if (attr.directive) {
          if (attr.namespace === config.DIRECTIVE_EVENT) {
            nativeOn[attr.name] = stringifyEvent(attr.expr)
          }
          else {
            nativeDirectives[attr.name] = stringifyDirective(attr.name, attr.value, attr.expr)
          }
        }
        else {
          nativeAttrs[keypathUtil.join(attr.namespace, attr.name)] = stringifyObject({
            namespace: toJSON(attr.namespace),
            name: toJSON(attr.name),
            value: toJSON(attr.value),
            children: stringifyChildren(attr.children),
          })
        }
      }
    )
  }

  // 目前只可能存在两个属性：text 和 html
  if (props) {
    array.each(
      props,
      function (prop) {
        nativeProps[prop.name === 'text' ? 'textContent' : 'innerHTML'] = prop.value
      }
    )
  }

  if (!object.empty(nativeAttrs)) {
    data.attrs = stringifyObject(nativeAttrs)
  }

  if (!object.empty(nativeProps)) {
    data.props = stringifyObject(nativeProps)
  }

  if (!object.empty(nativeOn)) {
    data.on = stringifyObject(nativeOn)
  }

  if (!object.empty(nativeDirectives)) {
    data.directives = stringifyObject(nativeDirectives)
  }

  return stringifyObject(data)

}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  const { tag, component, attrs, props, children } = node,

  args: any[] = [toJSON(tag)],

  data = component ? stringifyComponentData(attrs, props) : stringifyElementData(attrs, props)
console.log(data)
  if (data) {
    array.push(args, data)
  }

  if (children && children.length) {
    array.push(
      args,
      stringifyChildren(children)
    )
  }

  return stringifyCall('_c', args)

}

export function stringify(node: Node): string {
  console.log(node.type)
  return nodeStringify[node.type](node)
}