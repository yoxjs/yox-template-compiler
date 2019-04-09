import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Node from './Node'

/**
 * else if 节点
 */
export default interface ElseIf extends Node {

  expr: ExpressionNode

  next: Node

  children: Node[] | void

}
