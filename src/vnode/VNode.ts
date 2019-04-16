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

  node: Node | void

  tag: string | void

  isComponent: boolean | void

  isComment: boolean | void

  isSvg: boolean | void

  isStatic: boolean | void

  props: Record<string, any> | void

  slots: Record<string, string | VNode[]> | void

  nativeProps: Record<string, Property> | void

  nativeAttrs: Record<string, Attribute> | void

  directives: Record<string, Directive> | void

  binding: Record<string, Binding> | void

  on: Record<string, Event> | void

  model: Model | void

  transition: Record<string, (node: HTMLElement, vnode: VNode) => void> | void

  ref: string | void

  key: string | void

  text: string | void

  children: any[] | void

  hooks: Record<string, (node: HTMLElement, vnode: VNode, oldVndoe?: VNode) => void> | void

  instance: any

}