import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as config from 'yox-config/src/config'

import Node from '../src/node/Node'
import Element from '../src/node/Element'
import Directive from '../src/node/Directive'

test('空模板', () => {

  let ast = compile(`
    <div lazy></div>
  `)

  let attrs = (ast[0] as Element).attrs as Node[]
  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_LAZY)
  expect((attrs[0] as Directive).name).toBe('')
  expect((attrs[0] as Directive).expr).toBe(undefined)
  expect((attrs[0] as Directive).value).toBe(true)


  ast = compile(`
    <div lazy="100"></div>
  `)

  attrs = (ast[0] as Element).attrs as Node[]
  expect(attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect((attrs[0] as Directive).ns).toBe(config.DIRECTIVE_LAZY)
  expect((attrs[0] as Directive).name).toBe('')
  expect((attrs[0] as Directive).expr != null).toBe(true)
  expect((attrs[0] as Directive).value).toBe(100)

})

test('error', () => {

  let hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="0"></div>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)



  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="-1"></div>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)


  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="haha"></div>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)


  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy=""></div>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

})