
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

/**
 * 如果取值/设值指定了 . 或 ..，表示无需 lookup，而是直接操作某个层级
 */

export default class Context {

  /**
   * @param {Object} data
   * @param {?Context} parent
   */
  constructor(data, parent) {
    this.data = object.copy(data)
    this.parent = parent
    this.cache = { }
  }

  push(data) {
    return new Context(data, this)
  }

  format(keypath) {
    let instance = this, keys = keypathUtil.parse(keypath)
    if (keys[0] === 'this') {
      keys.shift()
      return {
        keypath: keypathUtil.stringify(keys),
        instance,
      }
    }
    else {
      let lookup = env.TRUE, index = 0
      let levelMap = { }
      levelMap[ keypathUtil.LEVEL_CURRENT ] = 0
      levelMap[ keypathUtil.LEVEL_PARENT ] = 1

      array.each(
        keys,
        function (key, i) {
          if (object.has(levelMap, key)) {
            lookup = env.FALSE
            if (levelMap[key]) {
              instance = instance.parent
              if (!instance) {
                return env.FALSE
              }
            }
          }
          else {
            index = i
            return env.FALSE
          }
        }
      )
      return {
        keypath: keypathUtil.stringify(keys.slice(index)),
        instance,
        lookup,
      }
    }
  }

  set(key, value) {
    let { instance, keypath } = this.format(key)
    if (instance && keypath) {
      if (object.has(instance.cache, keypath)) {
        delete instance.cache[keypath]
      }
      object.set(instance.data, keypath, value)
    }
  }

  get(key) {

    let { instance, keypath, lookup } = this.format(key)
    if (instance) {
      let { cache } = instance
      if (!object.has(cache, keypath)) {
        let result
        if (keypath) {
          if (lookup) {
            let keys = [ keypath ]
            while (instance) {
              result = object.get(instance.data, keypath)
              if (result) {
                break
              }
              else {
                instance = instance.parent
                keys.unshift(keypathUtil.LEVEL_PARENT)
              }
            }
            keypath = keys.join(keypathUtil.SEPARATOR_PATH)
          }
          else {
            result = object.get(instance.data, keypath)
          }
        }
        else {
          result = instance.data
        }

        if (result) {
          cache[keypath] = result.value
        }
      }

      return {
        keypath,
        value: cache[keypath],
      }
    }

    return {
      keypath,
    }

  }
}
