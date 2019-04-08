import Node from './Node'

/**
 * 属性节点
 *
 * @param {string|Expression} name 属性名
 */
export default interface Attribute extends Node {

  name: string

}
