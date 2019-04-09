import Branch from './Branch'

/**
 * 属性节点
 */
export default interface Attribute extends Branch {

  name: string

  namespace: string | void

  value: string | void

}
