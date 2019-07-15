import {
  PropertyHint,
} from 'yox-common/src/type/type'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * HTML 元素的 JavaScript 属性
 */
export default interface Property extends Branch {

  name: string

  hint: PropertyHint

  value?: string | number | boolean

  expr?: ExpressionNode

  binding?: boolean

}
