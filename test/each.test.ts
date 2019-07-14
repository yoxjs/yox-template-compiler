import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as exprNodeType from '../../yox-expression-compiler/src/nodeType'

import Node from '../src/node/Node'
import Each from '../src/node/Each'
import Element from '../src/node/Element'

test('循环', () => {

  let ast = compile(`
    <div>
      {{#each x}}
        111
      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EACH)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).to).toBe(undefined)
  expect((children[0] as Each).equal).not.toBe(true)
  expect((children[0] as Each).index).toBe(undefined)

})

test('循环 + 下标', () => {

  let ast = compile(`
    <div>
      {{#each x:index}}
        111
      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EACH)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).to).toBe(undefined)
  expect((children[0] as Each).equal).not.toBe(true)
  expect((children[0] as Each).index).toBe('index')

})

test('循环区间 =>', () => {

  let ast = compile(`
    <div>
      {{#each x => y:index}}
        111
      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EACH)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).equal).toBe(true)
  expect((children[0] as Each).index).toBe('index')

})

test('循环区间 ->', () => {

  let ast = compile(`
    <div>
      {{#each x -> y:index}}
        111
      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EACH)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).from.type).toBe(exprNodeType.IDENTIFIER)
  expect((children[0] as Each).equal).toBe(false)
  expect((children[0] as Each).index).toBe('index')

})

test('空循环', () => {

  let hasError = false

  try {
    let ast = compile(`
      <div>
        {{#each x}}

        {{/each}}
      </div>
    `)
    expect((ast[0] as Element).children).toBe(undefined)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

})
