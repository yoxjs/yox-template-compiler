import Property from './Property'
import Attribute from './Attribute'
import Directive from './Directive'
import Binding from './Binding'
import Event from './Event'
import Model from './Model'

/**
 * 虚拟节点
 */
export default interface VNode {

  el: Node | void

  tag: string

  isComponent: boolean

  isSvg: boolean

  isStatic: boolean

  props: Record<string, any> | void

  nativeProps: Record<string, Property> | void

  nativeAttrs: Record<string, Attribute> | void

  directives: Record<string, Directive> | void

  binding: Record<string, Binding> | void

  on: Record<string, Event> | void

  model: Model | void

  slot: string | void

  name: string | void

  transition: string | void

  ref: string | void

  key: string | void

  hooks: Record<string, Function> | void

}