import * as env from 'yox-common/util/env'
import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import * as nodeType from './nodeType'

import Attribute from './node/Attribute'
import Directive from './node/Directive'
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

export function createAttribute(name: string, namespace: string): Attribute {
  return {
    type: nodeType.ATTRIBUTE,
    name,
    namespace,
    children: env.UNDEFINED,
  }
}

export function createDirective(name: string, modifier: string): Directive {
  return {
    type: nodeType.DIRECTIVE,
    name,
    modifier,
    children: env.UNDEFINED,
  }
}

export function createEach(expr: ExpressionNode, index: string): Each {
  return {
    type: nodeType.EACH,
    expr,
    index,
  }
}

export function createElement(tag: string, component: boolean): Element {
  return {
    type: nodeType.ELEMENT,
    tag,
    component,
    divider: 0,
    children: env.UNDEFINED,
  }
}

export function createElse(): Else {
  return {
    type: nodeType.ELSE,
  }
}

export function createElseIf(expr: ExpressionNode): ElseIf {
  return {
    type: nodeType.ELSE_IF,
    expr,
    next: env.UNDEFINED,
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
    next: env.UNDEFINED,
    stump: env.FALSE
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
