import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import EventObject from 'yox-common/util/Event'

/**
 * 指令
 */
export default interface Directive {

  modifier: string | undefined

  value: any

  expr: ExpressionNode | undefined

  hooks: Record<string, Function>

  keypath: string

  handler: (event: EventObject, data: any) => void | void

}