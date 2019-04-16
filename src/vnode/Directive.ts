import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import EventObject from 'yox-common/util/Event'

import VNode from './VNode'

/**
 * 指令
 */
export default interface Directive {

  modifier: string | undefined

  value: any

  expr: ExpressionNode | undefined

  hooks: Record<string, (el: HTMLElement, node: Directive, vnode: VNode, oldVndoe?: VNode) => void>

  keypath: string

  handler: (event: EventObject, data: any) => void | void

}