import ExpressionNode from 'yox-expression-compiler/src/node/Node'

/**
 * 键值对
 */
export default interface Pair {

  name: string

  value: any | undefined

  expr: ExpressionNode | undefined

}
