import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'

import Node from '../src/node/Node'
import Element from '../src/node/Element'
import Directive from '../src/node/Directive'

test('event', () => {

  // 事件名转成驼峰
  let ast = compile('<Component on-get-out="click"></Component>')

  expect(ast.length).toBe(1)

  let root = ast[0] as Element
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('Component')
  expect((root as Element).isComponent).toBe(true)

  let attrs = root.attrs as Node[]
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).name).toBe('getOut')
  expect((attrs[0] as Directive).modifier).toBe(undefined)

  // 命名空间
  ast = compile('<Button on-submit.button="click"/>')

  root = ast[0] as Element
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('Button')
  expect((root as Element).isComponent).toBe(true)

  attrs = root.attrs as Node[]
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).name).toBe('submit')
  expect((attrs[0] as Directive).modifier).toBe('button')

  // 转驼峰
  ast = compile('<Button on-submit-test.button-test="click"></Button>')

  root = ast[0] as Element
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('Button')
  expect((root as Element).isComponent).toBe(true)

  attrs = root.attrs as Node[]
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).name).toBe('submitTest')
  expect((attrs[0] as Directive).modifier).toBe('buttonTest')

})

test('error', () => {

  let hasError = false

  try {
    compile('<div on-=></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 只能调用 methods 定义的方法
  try {
    compile('<div on-click="a.b()"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="123"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="[]"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 只能是 name.namespace
  try {
    compile('<div on-tap="a.b.c"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)




  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="list.0"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)





  hasError = false

  // 可以是一个字母
  try {
    compile('<div on-click="x"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

  hasError = false

  // 可以是单词
  try {
    compile('<div on-click="submit"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

  hasError = false

  // 可以是一个字母
  try {
    compile('<div on-click="x.y"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)


  hasError = false

  // 可以是单词
  try {
    compile('<div on-click="name.namespace"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)


  hasError = false

  // dom 可以转换相同的事件
  try {
    compile('<div on-click="click"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)



  hasError = false

  // 组件不能转换相同的事件
  try {
    compile('<Component on-click="click"></Component>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 转换后的名称不是连字符
  try {
    compile('<Component on-click="test-case"></Component>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 命名空间只能有一个 .
  try {
    compile('<Component on-a.b.c="xx"></Component>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

})
