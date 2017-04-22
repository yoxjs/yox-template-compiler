
import * as env from 'yox-common/util/env'
import * as object from 'yox-common/util/object'

import * as syntax from './syntax'
import * as nodeType from './nodeType'

import * as expressionNodeType from 'yox-expression-compiler/src/nodeType'

// if 带条件的
export const ifTypes = { }
// if 分支的
export const elseTypes = { }
// html 层级的节点类型
export const htmlTypes = { }
// 叶子节点类型
export const leafTypes = { }
// 支持绑定的表达式
export const bindableTypes = { }
// 内置指令，无需加前缀
export const builtInDirectives = { }
// 名称 -> 类型的映射
export const name2Type = { }
// 类型 -> 名称的映射
export const type2Name = { }

ifTypes[ nodeType.IF ] =
ifTypes[ nodeType.ELSE_IF ] =

elseTypes[ nodeType.ELSE_IF ] =
elseTypes[ nodeType.ELSE ] =

htmlTypes[ nodeType.ELEMENT ] =
htmlTypes[ nodeType.ATTRIBUTE ] =
htmlTypes[ nodeType.DIRECTIVE ] =

leafTypes[ nodeType.TEXT ] =
leafTypes[ nodeType.IMPORT ] =
leafTypes[ nodeType.SPREAD ] =
leafTypes[ nodeType.EXPRESSION ] =

bindableTypes[ expressionNodeType.MEMBER ] =
bindableTypes[ expressionNodeType.IDENTIFIER ] =

builtInDirectives[ syntax.DIRECTIVE_REF ] =
builtInDirectives[ syntax.DIRECTIVE_LAZY ] =
builtInDirectives[ syntax.DIRECTIVE_MODEL ] = env.TRUE

name2Type[ 'if' ] = nodeType.IF
name2Type[ 'each' ] = nodeType.EACH
name2Type[ 'partial' ] = nodeType.PARTIAL

object.each(
  name2Type,
  function (type, name) {
    type2Name[ type ] = name
  }
)
