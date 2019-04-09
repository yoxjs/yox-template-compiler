import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * if 节点
 */
export default interface If extends Branch {

  expr: ExpressionNode

  stump: boolean

  next: Node

}
