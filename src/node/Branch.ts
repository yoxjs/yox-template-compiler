import Node from './Node'

/**
 * 非叶子节点，即树干节点
 */
export default interface Branch extends Node {

  // 是否是不占位的虚拟节点
  // 即只有当 children.length > 0 时才有意义
  isVirtual?: boolean

  children?: Node[]

}
