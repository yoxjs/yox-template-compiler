
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
    this.data = object.copy(data)
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
    let instance = this
    let { keypath } = instance.formatKeypath(key)
    if (instance && keypath) {
      if (object.has(instance.cache, keypath)) {
        delete instance.cache[ keypath ]
      }
      object.set(instance.data, keypath, value)
    }
  }

  get(key) {

    let instance = this
    let { keypath, lookup } = instance.formatKeypath(key)
    let contextKeypath = instance.keypath, originalKeypath = keypath

    let { data, cache } = instance
    if (!object.has(cache, keypath)) {
      if (keypath) {
        let result

        if (lookup) {
          while (instance) {
            result = object.get(instance.data, keypath)
            if (result) {
              break
            }
            else {
              instance = instance.parent
            }
          }
        }
        else {
          result = object.get(data, keypath)
        }

        if (result) {
          cache[ keypath ] = {
            keypath: instance.joinKeypath(instance.keypath, keypath),
            value: result.value,
          }
        }
      }
      else {
        cache[ keypath ] = {
          keypath: contextKeypath,
          value: data,
        }
      }
    }
    if (object.has(cache, keypath)) {
      return cache[ keypath ]
    }

    logger.warn(`Failed to lookup "${key}".`)

    // 找不到就用当前的 keypath 吧
    return {
      keypath: instance.joinKeypath(contextKeypath, originalKeypath),
    }

  },

  formatKeypath(keypath) {
    let keys = keypathUtil.parse(keypath)
    if (keys[ 0 ] === env.THIS) {
      keys.shift()
      return {
        keypath: keypathUtil.stringify(keys),
      }
    }
    else {
      return {
        keypath: keypathUtil.stringify(keys),
        lookup: env.TRUE,
      }
    }
  },

  joinKeypath(keypath1, keypath2) {
    if (keypath1 && keypath2) {
      return keypath1 + keypathUtil.SEPARATOR_KEY + keypath2
    }
    else if (keypath1) {
      return keypath1
    }
    else if (keypath2) {
      return keypath2
    }
  }

}
