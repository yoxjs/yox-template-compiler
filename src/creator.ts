import {
  TAG_SLOT,
  TAG_PORTAL,
} from 'yox-config/src/config'

import * as constant from 'yox-common/src/util/constant'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import * as nodeType from './nodeType'

import Element from './node/Element'
import Attribute from './node/Attribute'
import Directive from './node/Directive'
import Style from './node/Style'
import Each from './node/Each'
import If from './node/If'
import Else from './node/Else'
import ElseIf from './node/ElseIf'
import Import from './node/Import'
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
    modifier,
  }
}

export function createStyle(): Style {
  return {
    type: nodeType.STYLE,
    isStatic: constant.TRUE,
  }
}

export function createEach(from: ExpressionNode, to: ExpressionNode | void, equal: boolean, index: string | void): Each {
  return {
    type: nodeType.EACH,
    from,
    to,
    equal: equal || constant.UNDEFINED,
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
    isStatic: !isComponent && tag !== TAG_SLOT && tag !== TAG_PORTAL,
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
    isStatic: expr.isStatic,
  }
}

export function createIf(expr: ExpressionNode): If {
  return {
    type: nodeType.IF,
    expr,
    isVirtual: constant.TRUE,
  }
}

export function createImport(expr: ExpressionNode): Import {
  return {
    type: nodeType.IMPORT,
    expr,
    isLeaf: constant.TRUE,
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