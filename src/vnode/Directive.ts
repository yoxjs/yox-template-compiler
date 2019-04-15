import ExpressionNode from 'yox-expression-compiler/src/node/Node'

/**
 * 指令
 */
export default interface Directive {

  modifier: string | undefined

  value: any

  expr: ExpressionNode | undefined

  hooks: Record<string, Function> | void

  keypath: string

}