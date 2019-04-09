
import { compile } from '../src/compiler'

import * as nodeType from '../src/nodeType'

function checkValue(node: any, text: string) {
  if (node.children) {
    expect(node.children.length).toBe(1)
    expect(node.children[0].type).toBe(nodeType.TEXT)
    expect(node.children[0].text).toBe(text)
  }
  else {
    expect(node.value).toBe(text)
  }
}

it('空模板', () => {

  let ast1 = compile(' ')

  expect(ast1.length).toBe(1)
  expect(ast1[0].type).toBe(nodeType.TEXT)
  expect(ast1[0].text).toBe(' ')

  let ast2 = compile('')

  expect(ast2.length).toBe(0)

})

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

it('匹配开始结束标签', () => {

  let hasError = false

  try {
    compile('<div></span>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div><a></b></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

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
  expect(ast[0].children[1].children).toBe(undefined)
  expect(ast[0].children[1].props.length).toBe(1)
  expect(ast[0].children[1].props[0].name).toBe('text')
  expect(ast[0].children[1].props[0].value).toBe('456')
  expect(ast[0].children[1].props[0].expr).toBe(undefined)

  expect(ast[0].children[2].type).toBe(nodeType.TEXT)
  expect(ast[0].children[2].text).toBe('789')
})

it('attribute', () => {

  let ast = compile('<div id="1" name="2" xml1:age="3" xml2:number="4">5</div>')
  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(4)
  expect(ast[0].props.length).toBe(1)
  expect(ast[0].children).toBe(undefined)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('id')
  expect(ast[0].attrs[0].namespace).toBe(undefined)
  checkValue(ast[0].attrs[0], '1')

  expect(ast[0].attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[1].name).toBe('name')
  expect(ast[0].attrs[1].namespace).toBe(undefined)
  checkValue(ast[0].attrs[1], '2')

  expect(ast[0].attrs[2].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[2].name).toBe('age')
  expect(ast[0].attrs[2].namespace).toBe('xml1')
  checkValue(ast[0].attrs[2], '3')

  expect(ast[0].attrs[3].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[3].name).toBe('number')
  expect(ast[0].attrs[3].namespace).toBe('xml2')
  checkValue(ast[0].attrs[3], '4')

  expect(ast[0].props[0].name).toBe('text')
  expect(ast[0].props[0].value).toBe('5')
  expect(ast[0].props[0].expr).toBe(undefined)

})

it('文本换行', () => {

  let ast = compile(`
    <div
      a="1"
      b="2"      c="3"
      d="4"
    >
      5
      6
    </div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(4)
  expect(ast[0].props.length).toBe(1)
  expect(ast[0].children).toBe(undefined)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('a')
  checkValue(ast[0].attrs[0], '1')

  expect(ast[0].attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[1].name).toBe('b')
  checkValue(ast[0].attrs[1], '2')

  expect(ast[0].attrs[2].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[2].name).toBe('c')
  checkValue(ast[0].attrs[2], '3')

  expect(ast[0].attrs[3].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[3].name).toBe('d')
  checkValue(ast[0].attrs[3], '4')

  expect(ast[0].props[0].name).toBe('text')
  expect(ast[0].props[0].value).toBe('5\n      6')
  expect(ast[0].props[0].expr).toBe(undefined)

})

it('默认属性值', () => {

  let ast = compile(`
    <div a b="">1</div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(2)
  expect(ast[0].props.length).toBe(1)
  expect(ast[0].children).toBe(undefined)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('a')
  checkValue(ast[0].attrs[0], undefined)

  expect(ast[0].attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[1].name).toBe('b')
  checkValue(ast[0].attrs[1], '')

  expect(ast[0].props[0].name).toBe('text')
  expect(ast[0].props[0].value).toBe('1')
  expect(ast[0].props[0].expr).toBe(undefined)

})

it('非转义插值', () => {

  let ast1 = compile(`
    <div>{{a}}</div>
  `)

  expect(ast1.length).toBe(1)
  expect(ast1[0].attrs).toBe(undefined)
  expect(ast1[0].props.length).toBe(1)
  expect(ast1[0].children).toBe(undefined)

  expect(ast1[0].props[0].name).toBe('text')
  expect(ast1[0].props[0].value).toBe(undefined)
  expect(typeof ast1[0].props[0].expr).toBe('object')

  let ast2 = compile(`
    <div>{{{a}}}</div>
  `)

  expect(ast2.length).toBe(1)
  expect(ast2[0].attrs).toBe(undefined)
  expect(ast2[0].props.length).toBe(1)
  expect(ast2[0].children).toBe(undefined)

  expect(ast2[0].props[0].name).toBe('html')
  expect(ast2[0].props[0].value).toBe(undefined)
  expect(typeof ast2[0].props[0].expr).toBe('object')

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
  // console.log(JSON.stringify(ast, 4, 4))
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

