import * as env from 'yox-common/src/util/env'

import * as nodeType from './nodeType'

// if 带条件的
export const ifTypes = {}
// if 分支的
export const elseTypes = {}
// 叶子节点类型
export const leafTypes = {}
// 复杂子节点类型
export const complexChildTypes = {}
// 特殊标签
export const specialTags = {}
// 特殊属性
export const specialAttrs = {}
// 名称 -> 类型的映射
export const name2Type = {}

ifTypes[nodeType.IF] =
ifTypes[nodeType.ELSE_IF] =

elseTypes[nodeType.ELSE_IF] =
elseTypes[nodeType.ELSE] =

leafTypes[nodeType.TEXT] =
leafTypes[nodeType.IMPORT] =
leafTypes[nodeType.SPREAD] =
leafTypes[nodeType.EXPRESSION] =

complexChildTypes[nodeType.ELEMENT] =
complexChildTypes[nodeType.IMPORT] =
complexChildTypes[nodeType.EACH] =

specialTags[env.RAW_SLOT] =
specialTags[env.RAW_TEMPLATE] =

specialAttrs[env.RAW_KEY] =
specialAttrs[env.RAW_REF] =
specialAttrs[env.RAW_SLOT] = env.TRUE

name2Type['if'] = nodeType.IF
name2Type['each'] = nodeType.EACH
name2Type['partial'] = nodeType.PARTIAL

