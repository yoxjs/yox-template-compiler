import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 指令
 */
export default interface Directive extends Branch {

  name: string

  modifier: string | undefined

  expr: ExpressionNode | undefined

  // bind 指令的 value 是 number
  value: string | number | undefined

}
