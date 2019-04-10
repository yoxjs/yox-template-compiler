import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'
import Else from './Else'

/**
 * else if 节点
 */
export default interface ElseIf extends Branch {

  expr: ExpressionNode

  next: ElseIf | Else

}
