import {
  PropertyHint,
} from 'yox-type/src/type'

import * as constant from 'yox-common/src/util/constant'
import * as keypathUtil from 'yox-common/src/util/keypath'

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
    isStatic: constant.TRUE,
    name,
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

export function createProperty(name: string, hint: PropertyHint, value?: string | number | boolean, expr?: ExpressionNode, children?: Node[]): Property {
  return {
    type: nodeType.PROPERTY,
    isStatic: constant.TRUE,
    name,
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
    isComplex: constant.TRUE,
  }
}

export function createElement(tag: string, isSvg: boolean, isStyle: boolean, isComponent: boolean): Element {
  return {
    type: nodeType.ELEMENT,
    tag,
    isSvg,
    isStyle,
    // 只有 <option> 没有 value 属性时才为 true
    isOption: constant.FALSE,
    isComponent,
    isStatic: !isComponent && tag !== constant.RAW_SLOT,
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
    isLeaf: constant.TRUE,
  }
}

export function createIf(expr: ExpressionNode): If {
  return {
    type: nodeType.IF,
    expr,
    // if 会产生注释节点，但不能直接加这句，要判断 if 位于元素层级才行
    // 即 <div>{{#if xx}}xx{{/if}}</div> 才会使得 div 变成 complex 节点
    // isComplex: constant.TRUE,
  }
}

export function createImport(name: string): Import {
  return {
    type: nodeType.IMPORT,
    name,
    isComplex: constant.TRUE,
    isLeaf: constant.TRUE,
  }
}

export function createPartial(name: string): Partial {
  return {
    type: nodeType.PARTIAL,
    name,
    isComplex: constant.TRUE,
  }
}

export function createSpread(expr: ExpressionNode, binding: boolean): Spread {
  return {
    type: nodeType.SPREAD,
    expr,
    binding,
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