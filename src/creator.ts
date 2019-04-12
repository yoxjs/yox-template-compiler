import * as env from 'yox-common/util/env'
import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import * as nodeType from './nodeType'

import Node from './node/Node'
import Attribute from './node/Attribute'
import Each from './node/Each'
import Element from './node/Element'
import Else from './node/Else'
import ElseIf from './node/ElseIf'
import Expression from './node/Expression'
import If from './node/If'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Text from './node/Text'
import Property from './node/Property'

export function createAttribute(name: string, directive: boolean, namespace?: string): Attribute {
  return {
    type: nodeType.ATTRIBUTE,
    name,
    directive,
    namespace,
    children: env.UNDEFINED,
    value: env.UNDEFINED,
    expr: env.UNDEFINED,
  }
}

export function createProperty(name: string, hint: number, value: string | number | boolean | void, expr?: ExpressionNode, children?: Node[]): Property {
  return {
    type: nodeType.PROPERTY,
    name,
    hint,
    value,
    expr,
    children,
  }
}

export function createEach(expr: ExpressionNode, index: string): Each {
  return {
    type: nodeType.EACH,
    expr,
    index,
    children: env.UNDEFINED,
  }
}

export function createElement(tag: string, svg: boolean, component: boolean): Element {
  return {
    type: nodeType.ELEMENT,
    tag,
    svg,
    component,
    slot: env.UNDEFINED,
    attrs: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createElse(): Else {
  return {
    type: nodeType.ELSE,
    children: env.UNDEFINED,
  }
}

export function createElseIf(expr: ExpressionNode): ElseIf {
  return {
    type: nodeType.ELSE_IF,
    expr,
    next: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createExpression(expr: ExpressionNode, safe: boolean): Expression {
  return {
    type: nodeType.EXPRESSION,
    expr,
    safe,
  }
}

export function createIf(expr: ExpressionNode): If {
  return {
    type: nodeType.IF,
    expr,
    stub: env.FALSE,
    next: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createImport(name: string): Import {
  return {
    type: nodeType.IMPORT,
    name,
  }
}

export function createPartial(name: string): Partial {
  return {
    type: nodeType.PARTIAL,
    name,
    children: env.UNDEFINED,
  }
}

export function createSpread(expr: ExpressionNode): Spread {
  return {
    type: nodeType.SPREAD,
    expr,
  }
}

export function createText(text: string): Text {
  return {
    type: nodeType.TEXT,
    text,
  }
}