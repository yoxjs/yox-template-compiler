import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as exprNodeType from '../../yox-expression-compiler/src/nodeType'

import Node from '../src/node/Node'
import Element from '../src/node/Element'
import Expression from '../src/node/Expression'

test('简单插值', () => {

  let ast = compile(`
    <div>
      {{name}}
    </div>
  `)

  let children = ast[0].children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EXPRESSION)
  expect((children[0] as Expression).safe).toBe(true)
  expect((children[0] as Expression).expr.type).toBe(exprNodeType.IDENTIFIER)

})

test('危险插值', () => {

  let ast = compile(`
    <div>
      {{{name}}}
    </div>
  `)

  expect(ast[0].children).toBe(undefined)
  expect((ast[0] as Element).html != null).toBe(true)

})

test('对象字面量', () => {

  let ast = compile(`
    <div>
      {{ { name: 'yox' } }}
    </div>
  `)

  let children = ast[0].children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EXPRESSION)
  expect((children[0] as Expression).safe).toBe(true)
  expect((children[0] as Expression).expr.type).toBe(exprNodeType.OBJECT)

})
