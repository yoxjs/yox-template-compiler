import * as config from 'yox-config'

import * as env from 'yox-common/util/env'

import * as nodeType from './nodeType'

// if 带条件的
export const ifTypes = {}
// if 分支的
export const elseTypes = {}
// 叶子节点类型
export const leafTypes = {}
// 简单子节点类型
export const simpleChildTypes = {}
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

simpleChildTypes[nodeType.TEXT] =
simpleChildTypes[nodeType.EXPRESSION] =
simpleChildTypes[nodeType.IF] =
simpleChildTypes[nodeType.ELSE_IF] =
simpleChildTypes[nodeType.ELSE] =

specialTags[env.RAW_SLOT] =
specialTags[env.RAW_TEMPLATE] =

specialAttrs[env.RAW_KEY] =
specialAttrs[env.RAW_REF] =
specialAttrs[env.RAW_SLOT] =
specialAttrs[env.RAW_TRANSITION] = env.TRUE

name2Type['if'] = nodeType.IF
name2Type['each'] = nodeType.EACH
name2Type['partial'] = nodeType.PARTIAL

