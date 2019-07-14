import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'

import Node from '../src/node/Node'
import If from '../src/node/If'
import ElseIf from '../src/node/ElseIf'
import Else from '../src/node/Else'
import Text from '../src/node/Text'

test('error', () => {

  let ast = compile(`
    {{#if x > 1}}
      a
    {{else if x < 0}}
      b
    {{else}}
      c
    {{/if}}
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.IF)

  let root = ast[0] as If
  expect((root.children as Node[]).length).toBe(1)

  let child = (root.children as Node[])[0]
  expect(child != null).toBe(true)
  if (child) {
    expect(child.type).toBe(nodeType.TEXT)
    expect((child as Text).text).toBe('a')
  }

  let elseIf = root.next as ElseIf
  expect(elseIf.type).toBe(nodeType.ELSE_IF)
  expect((elseIf.children as Node[]).length).toBe(1)
  expect((elseIf.children as Node[])[0].type).toBe(nodeType.TEXT)
  expect(((elseIf.children as Node[])[0] as Text).text).toBe('b')

  let last = elseIf.next as ElseIf
  expect(last.type).toBe(nodeType.ELSE)
  expect((last.children as Node[]).length).toBe(1)
  expect((last.children as Node[])[0].type).toBe(nodeType.TEXT)
  expect(((last.children as Node[])[0] as Text).text).toBe('c')

})

test('空 children', () => {

  let ast = compile('{{#if x > 1}}a{{else if x < 0}}{{else}}c{{/if}}')

  let root = ast[0] as If

  expect(root.children != null).toBe(true)
  expect((root.next as ElseIf).children).toBe(undefined)
  expect(((root.next as ElseIf).next as Else).children != null).toBe(true)


  ast = compile('{{#if x > 1}}a{{else if x < 0}}{{else}}{{/if}}')

  root = ast[0] as If

  expect(root.children != null).toBe(true)
  expect(root.next).toBe(undefined)

  ast = compile('{{#if x > 1}}{{else if x < 0}}{{else}}{{/if}}')

  expect(ast.length).toBe(0)

})