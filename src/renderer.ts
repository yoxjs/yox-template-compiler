import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

export const ELEMENT = '_c'

export const COMPONENT = '_d'

export const COMMENT = '_m'

export const EMPTY = '_n'

export const EXPR = '_s'

export const EACH = '_l'

export const RENDER = '_v'

const renderer = {}

renderer[ELEMENT] = function (tag: string, data: any | void, children: any[] | void) {

  if (is.array(data)) {
    children = data
    data = env.UNDEFINED
  }

  if (children) {

  }

}

renderer[COMPONENT] = function (tag: string, data: any | void) {

}

renderer[EACH] = function (value: any, index: string | Function, callback: Function | void) {

  if (is.func(index)) {
    callback = index as Function
    index = env.UNDEFINED
  }

  if (is.array(value)) {
    array.each(
      value,
      function (item: any, index: number) {

        let lastScope = scope, lastKeypath = keypath, lastKeypathStack = keypathStack

        scope = {}
        keypath = keypathUtil.join(eachKeypath, key)
        keypathStack = object.copy(keypathStack)
        array.push(keypathStack, keypath)
        array.push(keypathStack, scope)

        // 从下面这几句赋值可以看出
        // scope 至少会有 'keypath' 'this' 'index' 等几个值
        scope[config.SPECIAL_KEYPATH] = keypath

        // 类似 {{#each 1 -> 10}} 这样的临时循环，需要在 scope 上加上当前项
        // 因为通过 instance.get() 无法获取数据
        if (!absoluteKeypath) {
          scope[env.RAW_THIS] = item
        }

        if (index) {
          scope[index] = key
        }

        generate()

        scope = lastScope
        keypath = lastKeypath
        keypathStack = lastKeypathStack

      }
    )
  }
  else if (is.object(value)) {
    object.each(
      value,
      function (value: any, key: string) {

      }
    )
  }
  else if (is.func(value)) {
    value(callback)
  }

}