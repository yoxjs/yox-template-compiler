
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
    let { keypath } = formatKeypath(key)
    if (instance && keypath) {
      if (object.has(instance.cache, keypath)) {
        delete instance.cache[ keypath ]
      }
      object.set(instance.data, keypath, value)
    }
  }

  get(key) {

    let instance = this
    let { keypath, lookup } = formatKeypath(key)
    let originalKeypath = keypath, deps = { }

    let { data, cache } = instance
    let joinKeypath = function (context, keypath) {
      return keypathUtil.join(context.keypath, keypath)
    }
    let addDep = function (context, keypath, value) {
      let list = [ ]
      array.each(
        keypathUtil.parse(keypath),
        function (item, subpath) {
          array.push(list, item)
          subpath = keypathUtil.stringify(list)
          deps[ joinKeypath(context, subpath) ] = subpath === keypath ? value : context.get(subpath).value
        }
      )
    }

    if (!object.has(cache, keypath)) {
      addDep(instance, keypath, data)

      if (keypath) {
        let result

        if (lookup) {
          while (instance) {
            result = object.get(instance.data, keypath)
            if (result) {
              addDep(instance, keypath, result.value)
              break
            }
            else {
              addDep(instance, keypath, env.UNDEFINED)
              instance = instance.parent
            }
          }
        }
        else {
          result = object.get(data, keypath)
        }

        if (result) {
          cache[ keypath ] = {
            keypath: joinKeypath(instance, keypath),
            value: result.value,
            deps,
          }
        }
      }
      else {
        cache[ keypath ] = {
          keypath: instance.keypath,
          value: data,
          deps,
        }
      }
    }
    if (object.has(cache, keypath)) {
      return cache[ keypath ]
    }

    logger.warn(`Failed to lookup "${key}".`)

    // 找不到就用当前的 keypath 吧
    return {
      keypath: joinKeypath(this, keypath),
      deps,
    }

  }

}

function formatKeypath(keypath) {
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
}
