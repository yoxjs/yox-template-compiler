import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 指令
 */
export default interface Directive extends Branch {

  ns: string

  name: string

  // 修饰符
  modifier?: string

  // expr 和 value 二选一
  expr?: ExpressionNode

  // lazy 是 boolean 或 number
  value?: string | number | boolean

}
