import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Each from 'yox-template-compiler/src/node/Each'
import Element from 'yox-template-compiler/src/node/Element'

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
  // index 必须是 undefined，这样序列化后才不会输出这个参数
  expect((children[0] as Each).index).toBe(undefined)

})

test('循环 else', () => {

  let ast = compile(`
    <div>
      {{#each x}}
        111
      {{else}}
        222
      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]
  let next = (children[0] as Each).next

  expect(next).not.toBe(undefined)
  if (next) {
    expect(next.type).toBe(nodeType.ELSE)
    expect(next.children).not.toBe(undefined)
    expect((next.children as Node[]).length).toBe(1)
  }

})

test('循环 else 空分支', () => {

  let ast = compile(`
    <div>
      {{#each x}}
        111
      {{else}}

      {{/each}}
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]

  expect((children[0] as Each).next).toBe(undefined)

  ast = compile(`
    <div>
      {{#each x}}

      {{else}}

      {{/each}}
    </div>
  `)

  expect((ast[0] as Element).children).toBe(undefined)

})

test('循环 + 下标', () => {

  let ast = compile(`
    <div>
      {{#each x : index}}
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
      {{#each x => y : index}}
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
      {{#each x -> y : index}}
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
