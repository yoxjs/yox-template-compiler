import * as constant from 'yox-type/src/constant'

import * as nodeType from './nodeType'

// 特殊标签
export const specialTags = {}
// 特殊属性
export const specialAttrs = {}
// 名称 -> 类型的映射
export const name2Type = {}

specialTags[constant.RAW_SLOT] =
specialTags[constant.RAW_TEMPLATE] =

specialAttrs[constant.RAW_KEY] =
specialAttrs[constant.RAW_REF] =
specialAttrs[constant.RAW_SLOT] = constant.TRUE

name2Type['if'] = nodeType.IF
name2Type['each'] = nodeType.EACH
name2Type['partial'] = nodeType.PARTIAL

