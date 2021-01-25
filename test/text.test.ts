import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Attribute from 'yox-template-compiler/src/node/Attribute'

test('html entity', () => {

  let ast = compile(`
    <div>1&nbsp;2</div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  let root = ast[0] as Element
  expect(root.isComponent).toBe(false)
  expect(root.html).toBe('1&nbsp;2')
  expect(root.children).toBe(undefined)



  ast = compile(`
    <Component>1&nbsp;2</Component>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  root = ast[0] as Element
  expect(root.isComponent).toBe(true)
  expect(root.html).toBe(undefined)


  ast = compile(`
    <Component>
      <template slot="xx">
        1&nbsp;2
      </template>
    </Component>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  root = ast[0] as Element
  let children = root.children
  expect(Array.isArray(children)).toBe(true)
  if (children) {
    expect(children.length).toBe(1)
    expect(children[0].type).toBe(nodeType.ELEMENT)
    expect((children[0] as Element).html).toBe(undefined)
  }


  ast = compile(`
    <slot>1&nbsp;2</slot>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  root = ast[0] as Element
  expect(root.isComponent).toBe(false)
  expect(root.html).toBe(undefined)



  ast = compile(`
    <div>1&nbsp;2{{name}}</div>
  `)

  root = ast[0] as Element

  expect(root.html).toBe(undefined)
  expect(Array.isArray(root.children)).toBe(true)

})

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
  expect(root.isStatic).toBe(true)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('5\n      6')

  let attrs = root.attrs as Node[]
  let children = root.children as Node[]
  expect(attrs.length).toBe(4)
  expect(children).toBe(undefined)

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

})