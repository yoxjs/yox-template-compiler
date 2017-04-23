
import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as logger from 'yox-common/util/logger'
import * as keypathUtil from 'yox-common/util/keypath'

export default class Context {

  /**
   * @param {Object} data
   * @param {string} keypath
   * @param {?Context} parent
   */
  constructor(data, keypath, parent) {
    this.data = { }
    this.data[ env.THIS ] = data
    this.keypath = keypath
    this.parent = parent
    this.cache = { }
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
    data[ keypath || env.THIS ] = value
  }

  get(key) {

    let instance = this
    let { data, cache } = instance
    let { keypath, lookup } = formatKeypath(key)

    let joinKeypath = function (context, keypath) {
      return keypathUtil.join(context.keypath, keypath)
    }
    let getValue = function (data, keypath) {
      return object.exists(data, keypath)
        ? { value: data[ keypath ] }
        : object.get(data[ env.THIS ], keypath)
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
            keypath: joinKeypath(instance, keypath),
            value: result.value,
          }
        }
      }
      else {
        cache[ keypath ] = {
          keypath: instance.keypath,
          value: data[ env.THIS ],
        }
      }
    }
    cache = cache[ keypath ]
    if (cache) {
      return cache
    }

    logger.warn(`Failed to lookup "${key}".`)

    // 找不到就用当前的 keypath 吧
    return {
      keypath: joinKeypath(this, keypath),
    }

  }

}

function formatKeypath(keypath) {
  keypath = keypathUtil.normalize(keypath)
  let lookup = env.TRUE, items = keypathUtil.startsWith(keypath, env.THIS, env.TRUE)
  if (items) {
    keypath = items[ 1 ]
    lookup = env.FALSE
  }
  return { keypath, lookup }
}
