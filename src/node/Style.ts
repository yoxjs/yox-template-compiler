import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * HTML 元素的 style 属性
 */
export default interface Style extends Branch {

  value?: string

  expr?: ExpressionNode

}
