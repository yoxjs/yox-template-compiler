
import Node from './Node'
import * as nodeType from '../nodeType'

import * as env from 'yox-common/util/env'
import * as object from 'yox-common/util/object'

/**
 * import 节点
 *
 * @param {string} name
 */
export default class Import extends Node {

  constructor(options) {
    super(nodeType.IMPORT, env.FALSE)
    object.extend(this, options)
  }

  render(data) {
    let partial = data.partial(this.name)
    if (partial.type === nodeType.ELEMENT) {
      return partial.render(data)
    }
    else {
      return this.renderChildren(data, partial.children)
    }
  }

}
