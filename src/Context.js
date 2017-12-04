
import isNative from 'yox-common/function/isNative'

import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as config from 'yox-config'

export default class Context {

  /**
   * @param {Object} context
   * @param {string} keypath
   * @param {?Context} parent
   */
  constructor(data, keypath, parent) {

    let instance = this, temp = { }
    temp[ config.SPECIAL_KEYPATH ] = keypath

    instance.data = data
    instance.temp = temp
    instance.cache = { }

    if (parent) {
      instance.parent = parent
    }

  }

  push(data, keypath) {
    return new Context(data, keypath, this)
  }

  pop() {
    return this.parent
  }

  set(key, value) {
    let { temp, cache } = this
    let { keypath } = formatKeypath(key)
    if (keypath) {
      if (object.has(cache, keypath)) {
        delete cache[ keypath ]
      }
      temp[ keypath ] = value
    }
  }

  get(key) {

    let instance = this
    let { data, temp, cache } = instance
    let { keypath, lookup } = formatKeypath(key)

    if (!object.has(cache, keypath)) {

      let result

      if (keypath) {

        let getValue = function (instance, keypath) {
          let { data, temp } = instance, result
          if (object.exists(temp, keypath)) {
            result = {
              temp: env.TRUE,
              value: temp[ keypath ],
            }
          }
          else {
            result = object.get(data, keypath)
            if (result && isNative(result.value)) {
              logger.warn(`find a native function by ${keypath}.`)
            }
          }
          return result
        }

        if (lookup) {
          while (instance) {
            result = getValue(instance, keypath)
            if (result) {
              break
            }
            else {
              instance = instance.parent
            }
          }
        }
        else {
          result = getValue(instance, keypath)
        }
      }
      else {
        result = {
          value: data,
        }
      }

      if (result) {
        result.keypath = keypathUtil.join(
          instance.temp[ config.SPECIAL_KEYPATH ],
          keypath
        )
        cache[ keypath ] = result
      }

    }

    cache = cache[ keypath ]
    if (cache) {
      return cache
    }

    return {
      keypath: keypathUtil.join(
        temp[ config.SPECIAL_KEYPATH ],
        keypath
      )
    }

  }

}

function formatKeypath(keypath) {
  keypath = keypathUtil.normalize(keypath)
  let lookup = env.TRUE, length = keypathUtil.startsWith(keypath, env.RAW_THIS)
  if (is.number(length)) {
    keypath = string.slice(keypath, length)
    lookup = env.FALSE
  }
  return { keypath, lookup }
}