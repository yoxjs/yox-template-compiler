import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 键值对
 */
export default interface Property extends Branch {

  name: string

  hint: number

  value?: any

  expr?: ExpressionNode

  binding?: boolean

}
