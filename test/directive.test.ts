import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as config from '../../yox-config/src/config'

import Element from '../src/node/Element'
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


test('默认值', () => {

  let ast = compile('<div o-a></div>')

  expect(ast.length).toBe(1)

  let attrs = (ast[0] as Element).attrs as Node[]

  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_CUSTOM)
  expect((attrs[0] as Directive).value).toBe(true)

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


  // 指令不能用插值语法
  try {
    compile('<div o-custom="{{a}}"></div>')
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
