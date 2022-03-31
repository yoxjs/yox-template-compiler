
import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Attribute from 'yox-template-compiler/src/node/Attribute'

test('组件名称的识别方式', () => {

  let ast = compile('<Dog/>')

  expect(ast.length).toBe(1)

  let root = ast[0] as Element
  expect(root.isComponent).toBe(true)


  ast = compile('<app-header/>')

  expect(ast.length).toBe(1)

  root = ast[0] as Element
  expect(root.isComponent).toBe(true)

})

test('属性名驼峰化', () => {

  let ast = compile('<Dog a-b="1"/>')

  let root = ast[0] as Element
  let attrs = root.attrs as Node[]

  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).name).toBe('aB')


  ast = compile('<Dog aB="1"/>')

  root = ast[0] as Element
  attrs = root.attrs as Node[]

  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).name).toBe('aB')


  ast = compile('<Dog $1="1"/>')

  root = ast[0] as Element
  attrs = root.attrs as Node[]

  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).name).toBe('$1')


  ast = compile('<Dog _1="1"/>')

  root = ast[0] as Element
  attrs = root.attrs as Node[]

  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).name).toBe('_1')

})

test('组件默认 slot', () => {

  let ast = compile(`
    <div>
      <slot>11</slot>
    </div>
  `)

  expect(ast.length).toBe(1)

  let root = ast[0] as Element
  let children = root.children as Node[]
  expect(children).not.toBe(undefined)
  expect((children[0] as Element).name).toBe(undefined)

})

test('动态组件', () => {

  let ast = compile('<$name/>')

  expect(ast.length).toBe(1)

  let root = ast[0] as Element
  expect(root.isComponent).toBe(true)

})