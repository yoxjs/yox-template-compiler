import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'
import ExprNode from 'yox-expression-compiler/src/node/Node'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Expression from 'yox-template-compiler/src/node/Expression'

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

  const html = (ast[0] as Element).html
  expect(typeof html).toBe('object')
  expect((html as ExprNode).type).toBe(exprNodeType.IDENTIFIER)
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
