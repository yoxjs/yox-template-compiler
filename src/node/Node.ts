/**
 * 节点基类
 */
export default interface Node {

  type: number

  // 是否是静态节点
  isStatic?: boolean

  // 是否是复杂节点
  // 主要是判断当前节点的 children 是否包含复杂节点
  // 如果 children 都不是复杂节点，则 children 在运行时可以直接用 + 连接
  // 如果 children 包含一个复杂节点，则 children 在运行时表示为 [ child1, child2 ] 的形式
  // 为什么不用 isSimple 命名呢？
  // 因为所有节点，初始化时都是简单节点，我们就不傻傻的为每一种节点加上 isSimple: true 了
  isComplex?: boolean

  // 是否是叶子节点
  isLeaf?: boolean

}
