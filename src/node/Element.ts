import Branch from './Branch'
import Attribute from './Attribute'
import Spread from './Spread'
import Pair from './Pair'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  component: boolean

  slot: string | undefined

  attrs: (Attribute | Spread)[] | undefined

  props: Pair[] | undefined

}
