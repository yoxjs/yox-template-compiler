import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Attribute from 'yox-template-compiler/src/node/Attribute'

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
  expect(root.html).toBe(undefined)
  expect(root.text).toBe(undefined)
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect((attrs[0] as Attribute).value).toBe('<!-- xxx -->')

})

test('HTML 注释 - 地狱模式1', () => {

  let ast = compile(`
    <div>
      2<!-- <!-- {{name}} {{age}} --> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')


  ast = compile(`
    <div>
      <!-- <!-- {{name}} {{age}} --> -->
    </div>
  `)

  root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe(undefined)

})

test('HTML 注释 - 地狱模式2', () => {

  let ast = compile(`
    <div>
      2<!-- {{name}} {{age}} --> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('2 -->2')

})

test('HTML 注释 - 地狱模式3', () => {

  let ast = compile(`
    <div>
      2<!-- <!-- {{name}} {{age}} -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('2<!-- 2')

})

test('HTML 注释 - 地狱模式4', () => {

  let ast = compile(`
    <div>
      2<!-- <div>333</div> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')

})

test('HTML 注释 - 地狱模式5', () => {

  let ast = compile(`
    <div>
      <!-- <div> -->
      22
      <!-- </div> -->
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')

})

test('HTML 注释 - 地狱模式6', () => {

  let ast = compile(`
    <div>
      2<!-- <span>
        {{name}}
      </span> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')

})

test('HTML 注释 - 地狱模式6', () => {

  let ast = compile(`
    <div>
      2<!-- <span>
        {{name}}<!-- hello -->
      </span> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')

})

test('HTML 注释 - 地狱模式7', () => {

  let ast = compile(`
    <div>
      2<!-- <span>
        {{name}}<!-- hello
        {{name}}
        <!-- hi -->
        -->
      </span> -->2
    </div>
  `)

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('22')

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
  expect(root.html).toBe(undefined)
  expect(root.text).toBe(undefined)

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

  let root = ast[0] as Element

  expect(root.attrs).toBe(undefined)
  expect(root.children).toBe(undefined)
  expect(root.html).toBe(undefined)
  expect(root.text).toBe('12')

})
