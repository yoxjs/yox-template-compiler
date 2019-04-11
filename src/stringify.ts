import * as config from 'yox-config'

import isDef from 'yox-common/function/isDef'
import toJSON from 'yox-common/function/toJSON'

import * as env from 'yox-common/util/env'
import * as char from 'yox-common/util/char'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import * as nodeType from './nodeType'

import * as helper from './helper'
import * as renderer from './renderer'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import ExpressionIdentifier from 'yox-expression-compiler/src/node/Identifier'
import ExpressionCall from 'yox-expression-compiler/src/node/Call'

import Node from './node/Node'
import Text from './node/Text'
import Each from './node/Each'
import If from './node/If'
import ElseIf from './node/ElseIf'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Expression from './node/Expression'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Pair from './node/Pair'

const SEP_COMMA = ', '
const SEP_COLON = ': '
const SEP_PLUS = ' + '

function stringifyObject(obj: Object): string | void {
  const fields = []
  object.each(
    obj,
    function (value: any, key: string) {
      if (isDef(value)) {
        array.push(
          fields,
          `${toJSON(key)}${SEP_COLON}${value}`
        )
      }
    }
  )
  if (fields.length) {
    return `{ ${array.join(fields, SEP_COMMA)} }`
  }
}

function stringifyArray(arr: any[]): string {
  return `[ ${array.join(arr, SEP_COMMA)} ]`
}

function stringifyArrayString(str: string): string {
  return `[ ${str} ]`
}

function stringifyCall(name: string, arg: string): string {
  return `${name}(${arg})`
}

function stringifyExpression(expr: any): string {
  return stringifyCall(
    renderer.EXPRESSION,
    toJSON(expr.staticKeypath || expr)
  )
}

function stringifyEmpty(): string {
  return stringifyCall(renderer.EMPTY, char.CHAR_BLANK)
}

function stringifyComment(): string {
  return stringifyCall(renderer.COMMENT, char.CHAR_BLANK)
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

function stringifyDirective(value: string | undefined, expr: ExpressionNode | undefined): string | void {
  return stringifyObject({
    value: toJSON(value),
    expr: toJSON(expr),
  })
}

function stringifyValue(value: any, expr: ExpressionNode | void, children: Node[] | void): string | void {
  return isDef(value)
    ? toJSON(value)
    : expr
      ? stringifyExpression(expr)
      : stringifyNormalChildren(children)
}

function stringifyChildren(
  children: Node[] | void,
  callback: (childs: string[], hasComplexChild: boolean) => string
): string | void {
  if (children && children.length) {
    // 如果 children 只包含简单子节点，则用 + 连起来提升运行时性能
    let childs: string[] = [], hasComplexChild = env.FALSE
    array.each(
      children,
      function (child: Node) {
        if (!hasComplexChild
          && !helper.simpleChildTypes[child.type]
        ) {
          hasComplexChild = env.TRUE
        }
        array.push(childs, stringify(child))
      }
    )
    return callback(childs, hasComplexChild)
  }
}

function stringifyNormalChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], hasComplexChild: boolean): string {
      return hasComplexChild
        ? stringifyCall(renderer.CHILDREN, stringifyArray(childs))
        : array.join(childs, SEP_PLUS)
    }
  )
}

function stringifyElementChildren(children: Node[] | void): string | void {
  return stringifyChildren(
    children,
    function (childs: string[], hasComplexChild: boolean): string {
      return stringifyArrayString(
        array.join(childs, hasComplexChild ? SEP_COMMA : SEP_PLUS)
      )
    }
  )
}

function getComponentSlots(children: Node[] | void): Object {
  // 这里不用判断数组长度，因为下面会判断有效的 slot
  if (children) {

    const slots = { },

    addSlot = function (name: string, nodes: Node[]) {

      if (nodes && nodes.length) {
        array.push(
          slots[name] || (slots[name] = []),
          nodes
        )
      }
      // slot 即使是空也必须覆盖组件旧值
      // 否则当组件更新时会取到旧值
      // 这里不能写 undefined，否则序列化会被干掉
      else {
        slots[name] = env.NULL
      }

    }

    array.each(
      children,
      function (child: Node) {

        // 找到具名 slot
        if (child.type === nodeType.ELEMENT) {
          const element = child as Element
          if (element.slot) {
            addSlot(element.slot, element.children)
            return
          }
        }

        // 匿名 slot，名称统一为 children
        addSlot(env.RAW_CHILDREN, [child])

      }
    )

    // 全部收集完成之后，再序列化
    object.each(
      slots,
      function (list: any, name: string) {
        slots[name] = stringifyNormalChildren(list)
      }
    )

    return slots

  }
}

const nodeStringify = {}

nodeStringify[nodeType.ELEMENT] = function (node: Element): string {

  let { tag, component, attrs, props, children } = node,

  args: any[] = [toJSON(tag)],

  data: any = { },

  slots: any,

  childs: any,

  // 比如 <Custom {{...obj1}} {{...obj2}}/>
  // 用对象有两个问题，第一是延展操作不好写 key，第二是无法保证顺序
  elementProps = [],

  elementAttrs = [],

  elementOn = {},

  elementBind = {},

  elementDirectives = []

  if (attrs) {

    const addAttr = function (attr: Attribute) {
      if (attr.directive) {
        if (attr.namespace === config.DIRECTIVE_EVENT) {
          elementOn[attr.name] = stringifyEvent(attr.expr)
        }
        else if (attr.namespace === config.DIRECTIVE_BINDING) {
          elementBind[attr.name] = toJSON(attr.value)
        }
        else {
          array.push(
            elementDirectives,
            stringifyObject({
              name: toJSON(attr.name),
              value: stringifyDirective(attr.value, attr.expr)
            })
          )
        }
      }
      else if (helper.specialAttrs[attr.name]
        || tag === env.RAW_SLOT && attr.name === env.RAW_NAME
      ) {
        data[attr.name] = stringifyValue(attr.value, attr.expr, attr.children)
      }
      else if (component) {
        array.push(
          elementProps,
          stringifyObject({
            name: toJSON(attr.name),
            value: stringifyValue(attr.value, attr.expr, attr.children),
          })
        )
      }
      else {
        array.push(
          elementAttrs,
          stringifyObject({
            namespace: toJSON(attr.namespace),
            name: toJSON(attr.name),
            value: stringifyValue(attr.value, attr.expr, attr.children),
          })
        )
      }
    },

    addSpread = function (spread: Spread) {
      array.push(
        elementProps,
        stringifyObject({
          spread: stringifyExpression(spread.expr)
        })
      )
    }

    array.each(
      attrs,
      function (attr: Attribute | Spread) {
        if (attr.type === nodeType.ATTRIBUTE) {
          addAttr(attr as Attribute)
        }
        else {
          addSpread(attr as Spread)
        }
      }
    )

  }

  // 目前只可能存在两个属性：text 和 html
  if (props) {
    array.each(
      props,
      function (prop: Pair) {
        array.push(
          elementProps,
          stringifyObject({
            name: toJSON(prop.name),
            value: stringifyValue(prop.value, prop.expr),
          })
        )
      }
    )
  }

  if (component) {
    slots = getComponentSlots(children)
    if (slots && !object.empty(slots)) {
      data.slots = stringifyObject(slots)
    }
  }
  else {
    childs = stringifyElementChildren(children)
  }

  if (elementProps.length) {
    data.props = stringifyArray(elementProps)
  }

  if (elementAttrs.length) {
    data.attrs = stringifyArray(elementAttrs)
  }

  if (elementDirectives.length) {
    data.directives = stringifyArray(elementDirectives)
  }

  if (!object.empty(elementOn)) {
    data.on = stringifyObject(elementOn)
  }

  if (!object.empty(elementBind)) {
    data.bind = stringifyObject(elementBind)
  }

  data = stringifyObject(data)
  if (isDef(data)) {
    array.push(args, data)
  }

  if (isDef(childs)) {
    array.push(args, childs)
  }

  return stringifyCall(
    component ? renderer.COMPONENT : renderer.ELEMENT,
    array.join(args, SEP_COMMA)
  )

}

nodeStringify[nodeType.TEXT] = function (node: Text): string {
  return toJSON(node.text)
}

nodeStringify[nodeType.EXPRESSION] = function (node: Expression): string {
  return stringifyExpression(node.expr)
}

nodeStringify[nodeType.IF] = function (node: If): string {

  const { stub } = node,

  render = function (node: If | ElseIf) {

    let expr = stringifyExpression(node.expr),

    children = stringifyNormalChildren(node.children),

    nextNode = node.next,

    nextValue: string | void

    if (nextNode) {
      // 递归到最后一个条件
      if (nextNode.type === nodeType.ELSE) {
        nextValue = stringifyNormalChildren(nextNode.children)
      }
      else {
        nextValue = render(nextNode as ElseIf)
      }
    }
    // 到达最后一个条件，发现第一个 if 语句带有 stub，需标记出来
    else if (stub) {
      nextValue = stringifyComment()
    }

    return `${expr} ? ${isDef(children) ? children : stringifyEmpty()} : ${isDef(nextValue) ? nextValue : stringifyEmpty()}`

  }

  return render(node)

}

nodeStringify[nodeType.EACH] = function (node: Each): string {

  const list = stringifyValue(node.expr),

  index = node.index ? `, ${toJSON(node.index)}` : char.CHAR_BLANK,

  children = stringifyNormalChildren(node.children)

  return stringifyCall(renderer.EACH, `${list}${index}, function () { return ${children} }`)

}

export function stringify(node: Node): string {
  return nodeStringify[node.type](node)
}

export function convert(node: Node): Function {
  return new Function(
    renderer.EMPTY,
    renderer.COMMENT,
    renderer.EXPRESSION,
    renderer.CHILDREN,
    renderer.EACH,
    renderer.COMPONENT,
    renderer.ELEMENT,
    `return ${stringify(node)}`
  )
}