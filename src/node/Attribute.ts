import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 属性
 */
export default interface Attribute extends Branch {

  name: string

  namespace: string | undefined

  expr: ExpressionNode | undefined

  value: any | undefined

  binding: boolean | undefined

}
