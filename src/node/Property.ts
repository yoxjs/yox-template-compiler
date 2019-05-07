import * as type from '../../../yox-type/src/type'

import ExpressionNode from '../../../yox-expression-compiler/src/node/Node'
import Branch from './Branch'

/**
 * 键值对
 */
export default interface Property extends Branch {

  name: string

  hint: type.hint

  value?: any

  expr?: ExpressionNode

  binding?: boolean

}
