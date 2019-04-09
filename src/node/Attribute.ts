import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 属性节点
 */
export default interface Attribute extends Branch {

  name: string

  namespace: string | void

  expr: ExpressionNode | void

  value: string | void

}
