
import * as nodeType from '../nodeType'

import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'

/**
 * 节点基类
 */
export default class Node {

  constructor(type, hasChildren) {
    this.type = type
    if (hasChildren !== env.FALSE) {
      this.children = [ ]
    }
  }

  addChild(child) {
    this.children.push(child)
  }

  renderExpression(data) {
    let { context, keys, addDeps } = data
    let { value, deps } = this.expr.execute(context)
    let newDeps = { }
    object.each(
      deps,
      function (value, key) {
        newDeps[
          keypathUtil.resolve(
            keypathUtil.stringify(keys),
            key
          )
        ] = value
      }
    )
    addDeps(newDeps)
    return {
      value,
      deps: newDeps,
    }
  }

  renderChildren(data, children) {
    if (!children) {
      children = this.children
    }
    let list = [ ], item
    let i = 0, node, next
    while (node = children[i]) {
      item = node.render(data)
      if (item) {
        array.push(list, item)
        if (node.type === nodeType.IF
          || node.type === nodeType.ELSE_IF
        ) {
          // 跳过后面紧跟着的 elseif else
          while (next = children[i + 1]) {
            if (next.type === nodeType.ELSE_IF || next.type === nodeType.ELSE) {
              i++
            }
            else {
              break
            }
          }
        }
      }
      i++
    }
    return list
  }

  renderTexts(data) {
    let nodes = this.renderChildren(data)
    let { length } = nodes
    if (length === 1) {
      return nodes[0].content
    }
    else if (length > 1) {
      return nodes
      .map(
        function (node) {
          return node.content
        }
      )
      .join('')
    }
  }

  renderCondition(data) {
    let { value } = this.renderExpression(data)
    if (value) {
      return this.renderChildren(data)
    }
  }

}
