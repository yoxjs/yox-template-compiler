import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Element from 'yox-template-compiler/src/node/Element'

test('svg', () => {

  let ast = compile('<svg></svg')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('svg')
  expect((ast[0] as Element).isSvg).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)


  ast = compile('<font-face></font-face')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('font-face')
  expect((ast[0] as Element).isSvg).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)


  ast = compile('<missing-glyph></missing-glyph')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('missing-glyph')
  expect((ast[0] as Element).isSvg).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)


  ast = compile('<foreignObject></foreignObject')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('foreignObject')
  expect((ast[0] as Element).isSvg).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)


})