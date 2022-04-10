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

  // 主要用于标识 html 布尔属性值
  // 所有元素的 spellcheck 默认值为 true
  // img 元素的 draggable 默认值为 true
  defaultValue?: any

}
