import Branch from './Branch'

/**
 * 元素节点
 */
export default interface Element extends Branch {

  tag: string

  component: boolean

  // 用于区分 attribute 和 children
  divider: number

}
