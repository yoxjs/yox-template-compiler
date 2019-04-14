import ExpressionNode from 'yox-expression-compiler/src/node/Node'

/**
 * 指令
 */
export default interface Directive {

  name: string

  modifier: string | undefined

  value: any

  expr: ExpressionNode | undefined

  keypath: string

}