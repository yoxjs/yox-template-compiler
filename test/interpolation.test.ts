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

test('error', () => {

  let hasError = false

  try {
    compile(`
      <div>
        11
        {{{name}}}
      </div>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  try {
    compile(`
      <div>
        {{{name}}}
        11
      </div>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  try {
    compile(`
      <div class="{{{name}}}">
      </div>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)




  hasError = false

  try {
    compile(`
      <div>
        {{#if xx}}
          {{{name}}}
        {{/if}}
      </div>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)




  hasError = false

  try {
    compile(`
      <Dog>
        {{{name}}}
      </Dog>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  try {
    compile(`
      <Dog>
        <template slot="xx">
          {{{name}}}
        </template>
      </Dog>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  try {
    compile(`
      <div>
        <slot>
          {{{name}}}
        </slot>
      </div>
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


})