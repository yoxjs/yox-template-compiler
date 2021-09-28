import * as constant from 'yox-common/src/util/constant'
import * as string from 'yox-common/src/util/string'

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

export function parseStyleString(value: string, callback: (key: string, value: string) => void) {
  const parts = value.split(';')
  for (let i = 0, len = parts.length, item: string, index: number; i < len; i++) {
    item = parts[i]
    index = item.indexOf(':')
    if (index > 0) {
      const key = string.trim(item.substr(0, index))
      const value = string.trim(item.substr(index + 1))
      if (key && value) {
        callback(string.camelize(key), value)
      }
    }
  }
}