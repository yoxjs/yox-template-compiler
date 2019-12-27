/**
 * 节点基类
 */
export default interface Node {

  type: number

  // 是否是静态节点
  isStatic?: boolean

  // 是否是叶子节点
  isLeaf?: boolean

}
