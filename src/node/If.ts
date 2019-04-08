import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Node from './Node'

/**
 * if 节点
 */
export default interface If extends Node {

  expr: ExpressionNode

  next: Node

  stump: boolean

}
