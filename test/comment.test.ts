import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Property from 'yox-template-compiler/src/node/Property'
import Text from 'yox-template-compiler/src/node/Text'

test('HTML 注释', () => {

  let ast = compile(`
    <div id="<!-- xxx -->">
      <!-- 1 -->
      <!--
        1
        2
      -->
      <!--
        {{name}}
        {{age}}
      -->
    </div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  let root = ast[0] as Element
  let attrs = root.attrs as Node[]

  expect(root.children).toBe(undefined)
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.PROPERTY)
  expect((attrs[0] as Property).value).toBe('<!-- xxx -->')

})

test('HTML 注释 - 地狱模式1', () => {

  let ast = compile(`
    <div>
      2<!-- <!-- {{name}} {{age}} --> -->2
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]

  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('22')


  ast = compile(`
    <div>
      <!-- <!-- {{name}} {{age}} --> -->
    </div>
  `)

  expect((ast[0] as Element).children).toBe(undefined)

})

test('HTML 注释 - 地狱模式2', () => {

  let ast = compile(`
    <div>
      2<!-- {{name}} {{age}} --> -->2
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]

  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('22')

})

test('HTML 注释 - 地狱模式3', () => {

  let ast = compile(`
    <div>
      2<!-- <!-- {{name}} {{age}} -->2
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]

  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('22')

})

test('Mustache 注释', () => {

  let ast = compile(`
    <div
      {{!

      id="xx"
      name="xx"
      title="{{xx}}"

      }}
    >
      {{! 1}}
      {{!
        1
        2
      }}
      {{!
        {{name}}
        {{age}}
      }}
    </div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)

})

test('Mustache 注释 - 地狱模式', () => {

  let ast = compile(`
    <div>
      1
      {{!
        111
        {{name}}
        {{!
          {{age}}
        }}
      }}
      2
    </div>
  `)

  let children = (ast[0] as Element).children as Node[]

  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('12')

})
