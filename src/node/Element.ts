import Branch from './Branch'
import Attribute from './Attribute'
import Spread from './Spread'
import Property from './Property'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  svg: boolean

  component: boolean

  slot: string | undefined

  attrs: (Attribute | Spread)[] | undefined

  props: Property[] | undefined

}
