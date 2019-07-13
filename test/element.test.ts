import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'

import Element from '../src/node/Element'
import Property from '../src/node/Property'
import Text from '../src/node/Text'


test('匹配开始结束标签', () => {

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

test('简单的标签组合', () => {

  let ast = compile('<div>123<span>456</span>789</div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  const children = ast[0].children
  expect(children != null).toBe(true)
  if (children) {
    expect(children.length).toBe(3)

    expect(children[0].type).toBe(nodeType.TEXT)
    expect((children[0] as Text).text).toBe('123')

    expect(children[1].type).toBe(nodeType.ELEMENT)
    expect((children[1] as Element).tag).toBe('span')
    expect(((children[1] as Element).children as any[]).length).toBe(1)
    expect((children[1] as Element).attrs).toBe(undefined)

    expect(children[2].type).toBe(nodeType.TEXT)
    expect((children[2] as Text).text).toBe('789')
  }
})

test('style', () => {

  let ast = compile('<style></style>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('style')
  expect((ast[0] as Element).isStyle).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)

  // 为了兼容 IE，必须加 type 属性
  const { attrs } = ast[0] as Element
  expect(Array.isArray(attrs)).toBe(true)
  if (attrs) {
    expect(attrs.length).toBe(1)
    expect(attrs[0].type).toBe(nodeType.PROPERTY)
    expect((attrs[0] as Property).name).toBe('type')
    expect((attrs[0] as Property).value).toBe('text/css')
  }

})

test('option', () => {

  let ast = compile('<select><option>1</option></select>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('select')
  expect((ast[0] as Element).isComponent).toBe(false)

  // 为了兼容 IE，必须给 option 加 isOption 为 true
  const { children } = ast[0] as Element
  expect(Array.isArray(children)).toBe(true)
  if (children) {
    expect(children.length).toBe(1)
    expect(children[0].type).toBe(nodeType.ELEMENT)
    expect((children[0] as Element).tag).toBe('option')
    expect((children[0] as Element).isOption).toBe(true)
  }

})

test('支持多个根元素', () => {

  let ast = compile('<div></div><span></span><ul></ul>text')

  expect(ast.length).toBe(4)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  expect(ast[1].type).toBe(nodeType.ELEMENT)
  expect((ast[1] as Element).tag).toBe('span')

  expect(ast[2].type).toBe(nodeType.ELEMENT)
  expect((ast[2] as Element).tag).toBe('ul')

  expect(ast[3].type).toBe(nodeType.TEXT)
  expect((ast[3] as Text).text).toBe('text')
})