import Branch from './Branch'
import Attribute from './Attribute'
import Directive from './Directive'
import Property from './Property'
import If from './If'
import Spread from './Spread'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  isSvg: boolean

  isComponent: boolean

  // <template slot="xx">
  slot?: string

  // <slot name="xx">
  name?: string

  // <div ref="xx">
  ref?: Attribute

  // <div key="xx">
  key?: Attribute

  attrs?: (Attribute | Directive | Property | If | Spread)[]

}
