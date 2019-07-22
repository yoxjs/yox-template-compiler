import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'

test('子模板', () => {

  let ast = compile(`
    <div>
      {{#partial x}}
        111
      {{/partial}}
      {{> x}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(2)
  expect(children[0].type).toBe(nodeType.PARTIAL)
  expect(children[1].type).toBe(nodeType.IMPORT)

})

test('空模板', () => {

  let hasError = false

  try {
    let ast = compile(`
      <div>
        {{#partial x}}{{/partial}}
      </div>
    `)
    expect((ast[0] as Element).children).toBe(undefined)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

})
