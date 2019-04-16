import * as env from 'yox-common/util/env'
import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import * as nodeType from './nodeType'

import Node from './node/Node'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
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

export function createAttribute(name: string): Attribute {
  return {
    type: nodeType.ATTRIBUTE,
    isStatic: env.TRUE,
    name,
    value: env.UNDEFINED,
    expr: env.UNDEFINED,
    children: env.UNDEFINED,
    binding: env.UNDEFINED,
  }
}

export function createDirective(name: string, modifier?: string, value?: string | number, expr?: ExpressionNode, children?: Node[]): Directive {
  return {
    type: nodeType.DIRECTIVE,
    name,
    isStatic: env.FALSE,
    modifier,
    value,
    expr,
    children,
  }
}

export function createProperty(name: string, hint: number, value?: string | number | boolean, expr?: ExpressionNode, children?: Node[]): Property {
  return {
    type: nodeType.PROPERTY,
    isStatic: env.TRUE,
    name,
    hint,
    value,
    expr,
    children,
    binding: env.UNDEFINED,
  }
}

export function createEach(expr: ExpressionNode, index: string): Each {
  return {
    type: nodeType.EACH,
    expr,
    index,
    isStatic: env.FALSE,
    children: env.UNDEFINED,
  }
}

export function createElement(tag: string, isSvg: boolean, isComponent: boolean): Element {
  // 是 svg 就不可能是组件
  // 加这个判断的原因是，svg 某些标签含有 连字符 和 大写字母，比较蛋疼
  if (isSvg) {
    isComponent = env.FALSE
  }
  return {
    type: nodeType.ELEMENT,
    tag,
    isSvg,
    isComponent,
    isStatic: !isComponent,
    slot: env.UNDEFINED,
    name: env.UNDEFINED,
    ref: env.UNDEFINED,
    key: env.UNDEFINED,
    attrs: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createElse(): Else {
  return {
    type: nodeType.ELSE,
    isStatic: env.FALSE,
    children: env.UNDEFINED,
  }
}

export function createElseIf(expr: ExpressionNode): ElseIf {
  return {
    type: nodeType.ELSE_IF,
    expr,
    isStatic: env.FALSE,
    next: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createExpression(expr: ExpressionNode, safe: boolean): Expression {
  return {
    type: nodeType.EXPRESSION,
    expr,
    isStatic: env.FALSE,
    safe,
  }
}

export function createIf(expr: ExpressionNode): If {
  return {
    type: nodeType.IF,
    expr,
    isStatic: env.FALSE,
    stub: env.FALSE,
    next: env.UNDEFINED,
    children: env.UNDEFINED,
  }
}

export function createImport(name: string): Import {
  return {
    type: nodeType.IMPORT,
    name,
    isStatic: env.FALSE,
  }
}

export function createPartial(name: string): Partial {
  return {
    type: nodeType.PARTIAL,
    name,
    isStatic: env.FALSE,
    children: env.UNDEFINED,
  }
}

export function createSpread(expr: ExpressionNode, binding: boolean): Spread {
  return {
    type: nodeType.SPREAD,
    expr,
    binding,
    isStatic: env.FALSE,
  }
}

export function createText(text: string): Text {
  return {
    type: nodeType.TEXT,
    text,
    isStatic: env.TRUE,
  }
}