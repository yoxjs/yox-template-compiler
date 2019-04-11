import * as is from 'yox-common/util/is'

export const ELEMENT = '_c'

export const COMPONENT = '_d'

export const COMMENT = '_m'

export const EMPTY = '_n'

export const EXPR = '_s'

export const EACH = '_l'

export const RENDER = '_v'

const renderer = {}

renderer[COMPONENT] = function (tag: string, data: any | void, children: any[] | void) {

  if (is.array(data)) {
    children = data
  }

  if (children) {

  }
}