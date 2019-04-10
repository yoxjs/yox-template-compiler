import isDef from 'yox-common/function/isDef'
import toJSON from 'yox-common/function/toJSON'
import toString from 'yox-common/function/toString'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
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


function stringifyExpression(expr: Object): string {
  return stringifyCall('_s', toJSON(expr))
}

function stringifyCall(name: string, params?: any[]): string {

  const tuple = params
    ? array.join(params, ', ')
    : char.CHAR_BLANK

  return `${name}(${tuple})`

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

function stringifyEvent(expr: ExpressionNode): any {
  if (expr.type === exprNodeType.IDENTIFIER) {
    return {
      event: (expr as ExpressionIdentifier).name
    }
  }
  else if (expr.type === exprNodeType.CALL) {
    let { callee, args } = expr as ExpressionCall
    if (callee.type === exprNodeType.IDENTIFIER) {
      return {
        method: (callee as ExpressionIdentifier).name,
        args: args.length > 0
          ? args
          : env.UNDEFINED,
      }
    }
  }
}

function stringifyComponentData(attrs: Attribute[] | void, props: Pair[] | void): string | void {

  const data = {
    component: env.TRUE,
    props: env.UNDEFINED,
    on: env.UNDEFINED,
    directives: env.UNDEFINED,
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
            componentDirectives[attr.name] = {
              name: attr.name,
              value: attr.value,
              expr: attr.expr,
            }
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
    data.props = componentOn
  }

  if (!object.empty(componentDirectives)) {
    data.directives = componentDirectives
  }

  return toJSON(data)

}

function stringifyElementData(attrs: Attribute[] | void, props: Pair[] | void): string | void {

  const data = {
    attrs: env.UNDEFINED,
    props: env.UNDEFINED,
    on: env.UNDEFINED,
    directives: env.UNDEFINED,
  },

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
            nativeDirectives[attr.name] = {
              name: attr.name,
              value: attr.value,
              expr: attr.expr,
            }
          }
        }
        else {
          nativeAttrs[keypathUtil.join(attr.namespace, attr.name)] = {
            namespace: attr.namespace,
            name: attr.name,
            value: attr.value,
            children: attr.children,
          }
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
    data.attrs = nativeAttrs
  }

  if (!object.empty(nativeProps)) {
    data.props = nativeProps
  }

  if (!object.empty(nativeOn)) {
    data.on = nativeOn
  }

  if (!object.empty(nativeDirectives)) {
    data.directives = nativeDirectives
  }

  return toJSON(data)

}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  const { tag, component, attrs, props, children } = node,

  args: any[] = [toJSON(tag)],

  data = component ? stringifyComponentData(attrs, props) : stringifyElementData(attrs, props)

  if (data) {
    array.push(args, data)
  }

  if (children && children.length) {
    args.push(
      children.map(stringify)
    )
  }

  return stringifyCall('_c', args)

}

export function stringify(node: Node): string {
  return nodeStringify[node.type](node)
}