import ExpressionNode from '../../../yox-expression-compiler/src/node/Node'
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

  // 是否是 svg 类族元素
  isSvg: boolean

  // 是否是 <style> 元素
  isStyle: boolean

  // 是否是 <option> 元素
  isOption: boolean

  // 是否是组件元素，相对 DOM 元素来的
  // 如果未来要搞跨平台方案，此属性可忽略
  isComponent: boolean

  // <template slot="xx">
  slot?: string

  // <slot name="xx">
  name?: string

  // <div ref="xx">
  ref?: Attribute

  // <div key="xx">
  key?: Attribute

  // <div>{{{xx}}}</div>
  // <div>&nbsp;</div>
  html?: ExpressionNode | string

  attrs?: (Attribute | Property | Directive | If | Spread)[]

}
