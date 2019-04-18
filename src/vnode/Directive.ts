import Event from 'yox-common/util/Event'

import VNode from './VNode'

/**
 * 指令
 */
export default interface Directive {

  type: string

  name: string

  // 当前 vnode 所有指令唯一的一个 key
  key: string

  value?: any

  hooks?: Record<string, (node: Node | any, directive: Directive, vnode: VNode, oldVndoe?: VNode) => void>

  // 取值函数
  getter?: () => any

  // 事件或函数调用式的指令会编译成 handler
  handler?: (event: Event, data?: Record<string, any>) => void

  // 作用于 handler，用于限制调用频率
  // 需要外部自己应用 lazy 给 handler
  lazy?: number | boolean

  // 单向绑定的 keypath
  binding?: string

  // 单向绑定的 hint，用于区分 attr 和 prop
  hint?: number

}