import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Node from './Node'

/**
 * import 节点
 */
export default interface Import extends Node {

  expr: ExpressionNode

}
