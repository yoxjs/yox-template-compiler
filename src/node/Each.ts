import ExpressionNode from '../../../yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * each 节点
 *
 * @param expr
 * @param index 遍历索引值，对于数组来说是 0,1,2,...，对于对象来说是 key
 */
export default interface Each extends Branch {

  expr: ExpressionNode

  index: string

}
