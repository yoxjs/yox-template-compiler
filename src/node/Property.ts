import {
  PropertyHint,
} from 'yox-type/src/type'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * HTML 元素的 JavaScript 属性
 */
export default interface Property extends Branch {

  name: string

  // 命名空间，跟 Attribute 保持一致
  ns: string | void

  hint: PropertyHint

  value?: string | number | boolean

  expr?: ExpressionNode

}
