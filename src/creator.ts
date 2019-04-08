import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import * as nodeType from './nodeType'

import Attribute from './node/Attribute'
import Component from './node/Component'
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

export function createAttribute(name: string): Attribute {
  return {
    type: nodeType.ATTRIBUTE,
    name,
  }
}

export function createComponent(name: string): Component {
  return {
    type: nodeType.COMPONENT,
    name,
  }
}

export function createDirective(name: string, modifier: string): Directive {
  return {
    type: nodeType.DIRECTIVE,
    name,
    modifier,
  }
}

export function createEach(expr: ExpressionNode, index: string): Each {
  return {
    type: nodeType.EACH,
    expr,
    index,
  }
}

export function createElement(tag: string): Element {
  return {
    type: nodeType.ELEMENT,
    tag,
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
  }
}

export function createExpression(expr: ExpressionNode, safe: boolean): Expression {
  return {
    type: nodeType.EXPRESSION,
    expr,
    safe,
  }
}

export function createIf(expr: ExpressionNode, stump: boolean): If {
  return {
    type: nodeType.IF,
    expr,
    stump,
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
