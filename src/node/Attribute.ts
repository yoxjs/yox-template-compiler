import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 属性
 */
export default interface Attribute extends Branch {

  name: string

  // 命名空间
  // 如 xml:name，ns 是 xml
  ns: string | void

  expr?: ExpressionNode

  value?: any

}
