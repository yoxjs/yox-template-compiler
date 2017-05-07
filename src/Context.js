
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as string from 'yox-common/util/string'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

import * as syntax from './syntax'

export default class Context {

  /**
   * @param {Object} data
   * @param {string} keypath
   * @param {?Context} parent
   */
  constructor(data, keypath, parent) {

    let instance = this, context = { }

    context[ env.RAW_THIS ] = data
    context[ syntax.SPECIAL_KEYPATH ] = keypath
    instance.data = context
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
    let { data, cache } = this
    let { keypath } = formatKeypath(key)
    if (object.has(cache, keypath)) {
      delete cache[ keypath ]
    }
    data[ keypath || env.RAW_THIS ] = value
  }

  get(key) {

    let instance = this
    let { data, cache } = instance
    let { keypath, lookup } = formatKeypath(key)

    let getValue = function (data, keypath) {
      return object.exists(data, keypath)
        ? { value: data[ keypath ] }
        : object.get(data[ env.RAW_THIS ], keypath)
    }

    if (!object.has(cache, keypath)) {

      if (keypath) {
        let result

        if (lookup) {
          while (instance) {
            result = getValue(instance.data, keypath)
            if (result) {
              break
            }
            else {
              instance = instance.parent
            }
          }
        }
        else {
          result = getValue(data, keypath)
        }

        if (result) {
          cache[ keypath ] = {
            keypath: keypathUtil.join(
              instance.data[ syntax.SPECIAL_KEYPATH ],
              keypath
            ),
            value: result.value,
          }
        }
      }
      else {
        cache[ keypath ] = {
          keypath: data[ syntax.SPECIAL_KEYPATH ],
          value: data[ env.RAW_THIS ],
        }
      }
    }

    cache = cache[ keypath ]
    if (cache) {
      return cache
    }

    keypath = keypathUtil.join(
      data[ syntax.SPECIAL_KEYPATH ],
      keypath
    )

    return {
      keypath,
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
