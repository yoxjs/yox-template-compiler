import Node from './Node'

/**
 * Partial 节点
 */
export default interface Partial extends Node {

  name: string

  children: Node[] | void

}
