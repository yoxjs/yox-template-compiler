import * as is from 'yox-common/util/is'
import * as env from 'yox-common/util/env'
import * as array from 'yox-common/util/array'
import * as object from 'yox-common/util/object'
import * as keypathUtil from 'yox-common/util/keypath'
import isDef from 'yox-common/function/isDef';

export const ELEMENT = '_c'

export const COMPONENT = '_d'

export const EACH = '_l'

export const EMPTY = '_e'

export const COMMENT = '_m'

export const EXPRESSION = '_x'

export const CHILDREN = '_v'

const renderer = {}

function addNodes(list: any[], nodes: Node[]) {
  // nodes 会出现二维数组
  array.each(
    nodes,
    function (node) {
      // 某些节点计算得到空值，需要过滤
      if (isDef(node)) {
        array.push(list, node)
      }
    }
  )
}

renderer[EMPTY] = function () {
  return env.UNDEFINED
}

renderer[COMMENT] = function () {
  return 'comment'
}

renderer[EXPRESSION] = function (expr: string) {
  return 'expr'
}

renderer[CHILDREN] = function (nodes: Node[]) {

  const list = []

  addNodes(list, nodes)

  return list

}

renderer[ELEMENT] = function (tag: string, data: any | void, children: any[] | void): Object {

  const result: any = { tag }

  if (is.array(data)) {
    children = data
    data = env.UNDEFINED
  }

  if (data) {
    object.extend(result, data)
  }

  if (children) {
    result.children = children
  }

  return result

}

renderer[COMPONENT] = function (tag: string, data: any | void): Object {

  const result: any = { tag }

  if (data) {
    object.extend(result, data)
  }

  return result

}

renderer[EACH] = function (value: any, index: string | Function, callback?: Function) {

  if (is.func(index)) {
    callback = index as Function
    index = env.UNDEFINED
  }

  const list = []

  if (is.array(value)) {
    array.each(
      value,
      function (item: any, idx: number) {
        addNodes(list, callback())
      }
    )
  }
  else if (is.object(value)) {
    object.each(
      value,
      function (value: any, key: string) {
        addNodes(list, callback())
      }
    )
  }
  else if (is.func(value)) {
    value(
      function () {
        addNodes(list, callback())
      }
    )
  }

  return list

}

export function render(result: Function) {
  return result(
    renderer[EMPTY],
    renderer[COMMENT],
    renderer[EXPRESSION],
    renderer[CHILDREN],
    renderer[EACH],
    renderer[COMPONENT],
    renderer[ELEMENT]
  )
}