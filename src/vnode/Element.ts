import Property from './Property'
import Attribute from './Attribute'
import Directive from './Directive'
import Event from './Event'
import Model from './Model'
import Bind from './Bind'

/**
 * 元素
 */
export default interface Element {

  el: Node | void

  tag: string

  isComponent: boolean

  isSvg: boolean

  isStatic: boolean

  props: Record<string, any> | void

  nativeProps: Record<string, Property> | void

  nativeAttrs: Record<string, Attribute> | void

  on: Record<string, Event> | void

  bind: Record<string, Bind> | void

  directives: Record<string, Directive> | void

  model: Model | void

  slot: string | void

  name: string | void

  transition: string | void

  ref: string | void

  key: string | void

  hooks: Record<string, Function> | void

}