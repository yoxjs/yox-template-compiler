import {
  PropertyHint,
} from 'yox-type/src/type'

import * as constant from 'yox-common/src/util/constant'
import * as keypathUtil from 'yox-common/src/util/keypath'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

import * as nodeType from './nodeType'

import Node from './node/Node'
import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Property from './node/Property'
import Each from './node/Each'
import If from './node/If'
import Else from './node/Else'
import ElseIf from './node/ElseIf'
import Import from './node/Import'
import Partial from './node/Partial'
import Spread from './node/Spread'
import Expression from './node/Expression'
import Text from './node/Text'

export function createAttribute(name: string, ns: string | void): Attribute {
  return {
    type: nodeType.ATTRIBUTE,
    isStatic: constant.TRUE,
    name,
    ns,
  }
}

export function createDirective(name: string, ns: string, modifier?: string): Directive {
  return {
    type: nodeType.DIRECTIVE,
    ns,
    name,
    key: keypathUtil.join(ns, name),
    modifier,
  }
}

export function createProperty(name: string, ns: string | void, hint: PropertyHint, value?: string | number | boolean, expr?: ExpressionNode, children?: Node[]): Property {
  return {
    type: nodeType.PROPERTY,
    isStatic: constant.TRUE,
    name,
    ns,
    hint,
    value,
    expr,
    children,
  }
}

export function createEach(from: ExpressionNode, to: ExpressionNode | void, equal: boolean, index: string | void): Each {
  return {
    type: nodeType.EACH,
    from,
    to,
    equal,
    index,
    isVirtual: constant.TRUE,
  }
}

export function createElement(tag: string, dynamicTag: ExpressionNode | void, isSvg: boolean, isStyle: boolean, isComponent: boolean): Element {
  return {
    type: nodeType.ELEMENT,
    tag,
    dynamicTag,
    isSvg,
    isStyle,
    isComponent,
    // 只有 <option> 没有 value 属性时才为 true
    isOption: constant.FALSE,
    isStatic: !isComponent && tag !== constant.RAW_SLOT,
  }
}

export function createElse(): Else {
  return {
    type: nodeType.ELSE,
    isVirtual: constant.TRUE,
  }
}

export function createElseIf(expr: ExpressionNode): ElseIf {
  return {
    type: nodeType.ELSE_IF,
    expr,
    isVirtual: constant.TRUE,
  }
}

export function createExpression(expr: ExpressionNode, safe: boolean): Expression {
  return {
    type: nodeType.EXPRESSION,
    expr,
    safe,
    isLeaf: constant.TRUE,
    isStatic: expr.type === exprNodeType.LITERAL,
  }
}

export function createIf(expr: ExpressionNode): If {
  return {
    type: nodeType.IF,
    expr,
    isVirtual: constant.TRUE,
  }
}

export function createImport(name: string): Import {
  return {
    type: nodeType.IMPORT,
    name,
    isLeaf: constant.TRUE,
  }
}

export function createPartial(name: string): Partial {
  return {
    type: nodeType.PARTIAL,
    name,
    isVirtual: constant.TRUE,
  }
}

export function createSpread(expr: ExpressionNode): Spread {
  return {
    type: nodeType.SPREAD,
    expr,
    isLeaf: constant.TRUE,
  }
}

export function createText(text: string): Text {
  return {
    type: nodeType.TEXT,
    text,
    isStatic: constant.TRUE,
    isLeaf: constant.TRUE,
  }
}