import Property from './Property'
import Attribute from './Attribute'
import Directive from './Directive'

/**
 * 虚拟节点
 */
export default interface VNode {

  node: Node

  data: Record<string, any>

  tag: string | void

  isComponent: boolean | void

  isComment: boolean | void

  isText: boolean | void

  isSvg: boolean | void

  isStatic: boolean | void

  props: Record<string, any> | void

  slots: Record<string, string | VNode[]> | void

  nativeProps: Record<string, Property> | void

  nativeAttrs: Record<string, Attribute> | void

  directives: Record<string, Directive> | void

  model: any | void

  ref: string | void

  key: string | void

  text: string | void

  children: VNode[] | void

  // 组件的 parent
  // <Custom>
  //  <Dog />
  // </Custom>
  // 这里 Dog 传入了 Custom 内部，parent 指向实际的父级组件，即 Custom，而不是 instance
  parent: any

  instance: any

}