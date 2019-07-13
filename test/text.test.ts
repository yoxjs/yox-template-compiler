import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'

import Node from '../src/node/Node'
import Element from '../src/node/Element'
import Attribute from '../src/node/Attribute'
import Text from '../src/node/Text'

test('文本换行', () => {

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

  expect(ast[0].type).toBe(nodeType.ELEMENT)

  let root = ast[0] as Element
  expect(root.tag).toBe('div')
  expect(root.isComponent).toBe(false)
  expect(root.isSvg).toBe(false)
  expect(root.isComplex).not.toBe(true)
  expect(root.isStatic).toBe(true)

  let attrs = root.attrs as Node[]
  let children = root.children as Node[]
  expect(attrs.length).toBe(4)
  expect(children.length).toBe(1)

  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).name).toBe('a')
  expect((attrs[0] as Attribute).value).toBe('1')

  expect(attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[1] as Attribute).name).toBe('b')
  expect((attrs[1] as Attribute).value).toBe('2')

  expect(attrs[2].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[2] as Attribute).name).toBe('c')
  expect((attrs[2] as Attribute).value).toBe('3')

  expect(attrs[3].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[3] as Attribute).name).toBe('d')
  expect((attrs[3] as Attribute).value).toBe('4')

  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('5\n      6')

})