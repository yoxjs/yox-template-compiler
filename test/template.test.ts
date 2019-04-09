
import { compile } from '../src/compiler'

import * as nodeType from '../src/nodeType'

it('支持多个根元素', () => {

  let ast = compile('<div></div><span></span><ul></ul>text')

  expect(ast.length).toBe(4)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('div')

  expect(ast[1].type).toBe(nodeType.ELEMENT)
  expect(ast[1].tag).toBe('span')

  expect(ast[2].type).toBe(nodeType.ELEMENT)
  expect(ast[2].tag).toBe('ul')

  expect(ast[3].type).toBe(nodeType.TEXT)
  expect(ast[3].text).toBe('text')
})

it('简单的标签组合', () => {

  let ast = compile('<div>123<span>456</span>789</div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('div')

  expect(ast[0].children.length).toBe(3)

  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('123')

  expect(ast[0].children[1].type).toBe(nodeType.ELEMENT)
  expect(ast[0].children[1].tag).toBe('span')
  expect(ast[0].children[1].children.length).toBe(1)
  expect(ast[0].children[1].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[1].children[0].text).toBe('456')

  expect(ast[0].children[2].type).toBe(nodeType.TEXT)
  expect(ast[0].children[2].text).toBe('789')
})

it('自闭合标签', () => {


  let ast1 = compile('<div><br/></div>')
  expect(ast1.length).toBe(1)

  expect(ast1[0].type).toBe(nodeType.ELEMENT)
  expect(ast1[0].tag).toBe('div')

  expect(ast1[0].children.length).toBe(1)

  expect(ast1[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast1[0].children[0].tag).toBe('br')

  let ast2 = compile('<div><br></div>')
  expect(ast2.length).toBe(1)

  expect(ast2[0].type).toBe(nodeType.ELEMENT)
  expect(ast2[0].tag).toBe('div')

  expect(ast2[0].children.length).toBe(1)

  expect(ast2[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast2[0].children[0].tag).toBe('br')

  let ast3 = compile('<div><br>1</div>')
  expect(ast3.length).toBe(1)

  expect(ast3[0].type).toBe(nodeType.ELEMENT)
  expect(ast3[0].tag).toBe('div')

  expect(ast3[0].children.length).toBe(2)

  expect(ast3[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast3[0].children[0].tag).toBe('br')

  expect(ast3[0].children[1].type).toBe(nodeType.TEXT)
  expect(ast3[0].children[1].text).toBe('1')

})

it('if', () => {

  let ast = compile('{{#if x > 1}}a{{else if x < 0}}b{{else}}c{{/if}}')

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.IF)
  expect(ast[0].children.length).toBe(1)
  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('a')

  expect(ast[0].next.type).toBe(nodeType.ELSE_IF)
  expect(ast[0].next.children.length).toBe(1)
  expect(ast[0].next.children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].next.children[0].text).toBe('b')

  expect(ast[0].next.next.type).toBe(nodeType.ELSE)
  expect(ast[0].next.next.children.length).toBe(1)
  expect(ast[0].next.next.children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].next.next.children[0].text).toBe('c')

})

// it('瞎测', () => {

//   let ast = compile('<div key="ah{{a}}b" ref="haha" lazy="100" model="name{{name}}">text</div>')

// })

