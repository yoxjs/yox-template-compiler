import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'
import Attribute from './Attribute'
import Directive from './Directive'
import Style from './Style'
import If from './If'
import Spread from './Spread'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  dynamicTag: ExpressionNode | void

  // 是否是 svg 类族元素
  isSvg: boolean

  // 是否是 <style> 元素
  isStyle: boolean

  // 是否是平台内置元素
  isNative: boolean

  // 是否是组件元素，而不是平台内置元素
  isComponent: boolean

  // <template slot="xx">
  slot?: string

  // <slot name="xx">
  name?: Attribute

  // <portal to="#id">
  to?: Attribute

  // <div ref="xx">
  ref?: Attribute

  // <div key="xx">
  key?: Attribute

  // <div>{{{xx}}}</div>
  // <div>&nbsp;</div>
  html?: ExpressionNode | string

  // <div>{{xx}}</div>
  // <div>123</div>
  text?: ExpressionNode | string

  attrs?: (Attribute | Style | Directive | If | Spread)[]

}
