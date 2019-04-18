import Event from 'yox-common/util/Event'

import VNode from './VNode'

/**
 * 指令
 */
export default interface Directive {

  name: string

  modifier: string | undefined

  value: any

  hooks: Record<string, (node: Node, directive: Directive, vnode: VNode, oldVndoe?: VNode) => void>

  // 取值函数
  getter: () => any | void

  // 事件或函数调用式的指令会编译成 handler
  handler: (event: Event, data?: Record<string, any>) => void | void

  // 作用于 handler，用于限制调用频率
  lazy: number | boolean | void

  // 单向绑定的 keypath
  binding: string | void

  // 单向绑定的 hint，用于区分 attr 和 prop
  hint: number | void

}