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

  slots: Record<string, string | any[]> | void

  nativeProps: Record<string, Property> | void

  nativeAttrs: Record<string, Attribute> | void

  directives: Record<string, Directive> | void

  binding: Record<string, Binding> | void

  on: Record<string, Event> | void

  model: Model | void

  transition: Record<string, (el: HTMLElement, vnode: VNode) => void> | void

  slot: string | void

  ref: string | void

  key: string | void

  text: string | void

  children: any[] | void

  hooks: Record<string, (el: HTMLElement, vnode: VNode, oldVndoe?: VNode) => void> | void

  instance: any

}