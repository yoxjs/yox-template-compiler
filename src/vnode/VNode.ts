import Property from './Property'
import Attribute from './Attribute'
import Directive from './Directive'

/**
 * 虚拟节点
 */
export default interface VNode {

  data: Record<string, any>

  tag?: string

  isComponent?: boolean

  isComment?: boolean

  isText?: boolean

  isSvg?: boolean

  isStatic?: boolean

  props?: Record<string, any>

  slots?: Record<string, string | VNode[]>

  nativeProps?: Record<string, Property>

  nativeAttrs?: Record<string, Attribute>

  directives?: Record<string, Directive>

  model?: any

  ref?: string

  key?: string

  text?: string

  children?: VNode[]

  // 组件的 parent
  // <Custom>
  //  <Dog />
  // </Custom>
  // 这里 Dog 传入了 Custom 内部，parent 指向实际的父级组件，即 Custom，而不是 instance
  parent?: any

  instance?: any

  // 渲染节点时的 keypath
  keypath?: string

}