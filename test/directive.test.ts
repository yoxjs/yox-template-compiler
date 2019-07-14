import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as config from '../../yox-config/src/config'

import Element from '../src/node/Element'
import Property from '../src/node/Property'
import Attribute from '../src/node/Attribute'
import Directive from '../src/node/Directive'
import Node from '../src/node/Node'

test('自动转型', () => {

  let ast = compile('<div o-a="1"></div>')

  let attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(1)


  ast = compile('<div o-a="x"></div>')

  attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe('x')



  ast = compile('<div o-a="true"></div>')

  attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(true)


  ast = compile('<div o-a="null"></div>')

  attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(null)


  ast = compile('<div o-a="undefined"></div>')

  attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(undefined)

})


test('自定义指令支持不合法的表达式', () => {

  let ast = compile('<div o-a="我"></div>')

  let attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe('我')

})


test('修饰符', () => {

  let ast = compile('<div o-a="x"></div>')

  let attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe('x')
  expect((attrs[0] as Directive).modifier).toBe(undefined)


  ast = compile('<div o-a.b="x"></div>')

  attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).modifier).toBe('b')

})


test('默认值', () => {

  let ast = compile('<div o-a></div>')

  expect(ast.length).toBe(1)

  let attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(true)

})


test('binding', () => {

  let ast = compile(`
    <div id="{{id}}" class="{{a.b.c}}" name="{{a + b}}" title="1" data-xx="{{id}}"></div>
  `)

  expect(ast.length).toBe(1)

  let root = ast[0] as Element
  let attrs = root.attrs as Node[]

  expect(attrs.length).toBe(5)
  expect(root.children).toBe(undefined)

  expect(attrs[0].type).toBe(nodeType.PROPERTY)
  expect((attrs[0] as Property).name).toBe('id')
  expect((attrs[0] as Property).binding).toBe(true)

  expect(attrs[1].type).toBe(nodeType.PROPERTY)
  expect((attrs[1] as Property).name).toBe('className')
  expect((attrs[1] as Property).binding).toBe(true)

  expect(attrs[2].type).toBe(nodeType.PROPERTY)
  expect((attrs[2] as Property).name).toBe('name')
  expect((attrs[2] as Property).binding).toBe(undefined)

  expect(attrs[3].type).toBe(nodeType.PROPERTY)
  expect((attrs[3] as Property).name).toBe('title')
  expect((attrs[3] as Property).binding).toBe(undefined)


  expect(attrs[4].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[4] as Attribute).name).toBe('data-xx')
  expect((attrs[4] as Attribute).binding).toBe(true)

})

test('error', () => {

  let hasError = false

  // model 只能用标识符或 memeber
  try {
    compile('<div model="11"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // model 只能用标识符或 memeber
  try {
    compile('<div model="a()"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  // model 只能用标识符或 memeber
  try {
    compile('<div model="true"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 函数调用只能用标识符
  try {
    compile('<div o-tap="a.b()"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 函数调用只能用标识符
  try {
    compile('<div o-tap="a()"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)


  hasError = false

  // 指令不能用插值语法
  try {
    compile('<div o-custom="{{a}}"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 修饰符只能有一个点号
  try {
    compile('<div o-a.b.c="x"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)




  hasError = false

  // 转换事件只能用标识符
  try {
    compile('<div on-click="123"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // 转换组件事件名称不能相同
  try {
    compile('<Dog on-click="click"/>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

})
