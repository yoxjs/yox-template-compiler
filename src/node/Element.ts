import Branch from './Branch'
import Attribute from './Attribute'
import Pair from './Pair'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  component: boolean

  attrs: Attribute[] | void

  props: Pair[] | void

}
