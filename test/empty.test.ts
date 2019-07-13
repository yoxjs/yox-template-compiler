import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'

import Text from '../src/node/Text'

test('空模板', () => {

  let ast = compile(' ')

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.TEXT)
  expect((ast[0] as Text).text).toBe(' ')

  ast = compile('')

  expect(ast.length).toBe(0)

})

test('无标签', () => {

  let ast = compile('11')

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.TEXT)
  expect((ast[0] as Text).text).toBe('11')

})