import {
  ATTR_KEY,
  ATTR_REF,
  TAG_SLOT,
  TAG_PORTAL,
  TAG_FRAGMENT,
  TAG_TEMPLATE,
  VNODE_TYPE_FRAGMENT,
  VNODE_TYPE_PORTAL,
} from 'yox-config/src/config'

import * as constant from 'yox-common/src/util/constant'
import * as string from 'yox-common/src/util/string'

import * as nodeType from './nodeType'

// 特殊标签
export const specialTags = {}
// 特殊属性
export const specialAttrs = {}
// 名称 -> 类型的映射
export const name2Type = {}
// 标签名 -> vnode 类型的映射
export const specialTag2VNodeType = {}

specialTags[TAG_SLOT] =
specialTags[TAG_TEMPLATE] =

specialAttrs[ATTR_KEY] =
specialAttrs[ATTR_REF] =
specialAttrs[TAG_SLOT] = constant.TRUE

name2Type['if'] = nodeType.IF
name2Type['each'] = nodeType.EACH
name2Type['partial'] = nodeType.PARTIAL

specialTag2VNodeType[TAG_FRAGMENT] = VNODE_TYPE_FRAGMENT
specialTag2VNodeType[TAG_PORTAL] = VNODE_TYPE_PORTAL

export function parseStyleString(value: string, callback: (key: string, value: string) => void) {
  const parts = value.split(';')
  for (let i = 0, len = parts.length; i < len; i++) {
    const item = parts[i]
    const index = item.indexOf(':')
    if (index > 0) {
      const key = string.trim(item.substr(0, index))
      const value = string.trim(item.substr(index + 1))
      if (key && value) {
        callback(string.camelize(key), value)
      }
    }
  }
}