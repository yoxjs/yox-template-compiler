import Node from './Node'

/**
 * 元素节点
 */
export default interface Element extends Node {

  tag: string

  component: boolean

  divider: number

  children: Node[] | void

}
