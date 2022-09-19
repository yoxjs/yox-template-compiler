import {
  ATTR_KEY,
  ATTR_REF,
  TAG_SLOT,
  TAG_PORTAL,
  TAG_FRAGMENT,
  TAG_TEMPLATE,
  VNODE_TYPE_FRAGMENT,
  VNODE_TYPE_PORTAL,
  VNODE_TYPE_SLOT,
  ATTR_TO,
  ATTR_NAME,
} from 'yox-config/src/config'

import * as constant from 'yox-common/src/util/constant'
import * as string from 'yox-common/src/util/string'

import * as nodeType from './nodeType'
import Attribute from './node/Attribute'
import Element from './node/Element'

// 特殊标签
export const specialTags = {}
// 特殊属性
const specialAttrs = {}
// 名称 -> 类型的映射
export const name2Type = {}
// 标签名 -> vnode 类型的映射
export const specialTag2VNodeType = {}

specialTags[TAG_SLOT] =
specialTags[TAG_PORTAL] =
specialTags[TAG_FRAGMENT] =
specialTags[TAG_TEMPLATE] =

specialAttrs[ATTR_KEY] =
specialAttrs[ATTR_REF] =
specialAttrs[TAG_SLOT] = constant.TRUE

name2Type['if'] = nodeType.IF
name2Type['each'] = nodeType.EACH

specialTag2VNodeType[TAG_FRAGMENT] = VNODE_TYPE_FRAGMENT
specialTag2VNodeType[TAG_PORTAL] = VNODE_TYPE_PORTAL
specialTag2VNodeType[TAG_SLOT] = VNODE_TYPE_SLOT

export function isSpecialAttr(element: Element, attr: Attribute) {
  return specialAttrs[attr.name]
    || element.tag === TAG_PORTAL && attr.name === ATTR_TO
    || element.tag === TAG_SLOT && attr.name === ATTR_NAME
}

export function parseStyleString(source: string, callback: (key: string, value: string) => void) {
  const parts = source.split(';')
  for (let i = 0, len = parts.length; i < len; i++) {
    const item = parts[i]
    const index = item.indexOf(':')
    if (index > 0) {
      const key = string.trim(item.substring(0, index))
      const value = string.trim(item.substring(index + 1))
      if (key && value) {
        callback(string.camelize(key), value)
      }
    }
  }
}