import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'
import * as config from 'yox-config/src/config'

import Element from 'yox-template-compiler/src/node/Element'
import Attribute from 'yox-template-compiler/src/node/Attribute'
import Property from 'yox-template-compiler/src/node/Property'

test('property', () => {

  let ast = compile(`
    <div
      id="1"
      width="100"
      disabled="true"
      draggable
      data-id="yox"
      data-name
      xml1:age="3"
      xml2:number="4"
      custom1
      custom2=""
      custom3="{{3}}"
      readonly="{{true}}"
    >
      5
    </div>
  `)

  expect(ast.length).toBe(1)

  let root = ast[0]
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('div')
  expect((root as Element).isComponent).toBe(false)

  let { attrs, children, html, text } = root as Element
  expect(Array.isArray(attrs)).toBe(true)
  expect(children).toBe(undefined)
  expect(html).toBe(undefined)
  expect(text).toBe('5')

  if (attrs) {
    expect(attrs.length).toBe(12)

    expect(attrs[0].type).toBe(nodeType.PROPERTY)
    expect((attrs[0] as Property).name).toBe('id')
    expect((attrs[0] as Property).hint).toBe(config.HINT_STRING)
    expect((attrs[0] as Property).value).toBe('1')

    expect(attrs[1].type).toBe(nodeType.PROPERTY)
    expect((attrs[1] as Property).name).toBe('width')
    expect((attrs[1] as Property).hint).toBe(config.HINT_NUMBER)
    expect((attrs[1] as Property).value).toBe(100)

    expect(attrs[2].type).toBe(nodeType.PROPERTY)
    expect((attrs[2] as Property).name).toBe('disabled')
    expect((attrs[2] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[2] as Property).value).toBe(true)

    expect(attrs[3].type).toBe(nodeType.PROPERTY)
    expect((attrs[3] as Property).name).toBe('draggable')
    expect((attrs[3] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[3] as Property).value).toBe(true)

    expect(attrs[4].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[4] as Attribute).name).toBe('data-id')
    expect((attrs[4] as Attribute).value).toBe('yox')

    // data- 默认值是空字符串
    expect(attrs[5].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[5] as Attribute).ns).toBe(undefined)
    expect((attrs[5] as Attribute).name).toBe('data-name')
    expect((attrs[5] as Attribute).value).toBe('')

    expect(attrs[6].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[6] as Attribute).ns).toBe('xml1')
    expect((attrs[6] as Attribute).name).toBe('age')
    expect((attrs[6] as Attribute).value).toBe('3')

    expect(attrs[7].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[7] as Attribute).ns).toBe('xml2')
    expect((attrs[7] as Attribute).name).toBe('number')
    expect((attrs[7] as Attribute).value).toBe('4')

    // 无值，值为 name
    expect(attrs[8].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[8] as Attribute).name).toBe('custom1')
    expect((attrs[8] as Attribute).value).toBe('custom1')

    expect(attrs[9].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[9] as Attribute).name).toBe('custom2')
    expect((attrs[9] as Attribute).value).toBe('')

    expect(attrs[10].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[10] as Attribute).name).toBe('custom3')
    expect((attrs[10] as Attribute).value).toBe(3)

    expect(attrs[11].type).toBe(nodeType.PROPERTY)
    expect((attrs[11] as Property).name).toBe('readOnly')
    expect((attrs[11] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[11] as Property).value).toBe(true)
  }




  ast = compile(`
    <Dog
      isLive
      is-animal
    />
  `)

  expect(ast.length).toBe(1)

  root = ast[0]
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('Dog')
  expect((root as Element).isComponent).toBe(true)

  attrs = (root as Element).attrs
  children = (root as Element).children
  expect(Array.isArray(attrs)).toBe(true)
  expect(children).toBe(undefined)

  if (attrs) {
    expect(attrs.length).toBe(2)

    expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[0] as Attribute).name).toBe('isLive')
    expect((attrs[0] as Attribute).value).toBe(true)

    expect(attrs[1].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[1] as Attribute).name).toBe('isAnimal')
    expect((attrs[1] as Attribute).value).toBe(true)
  }

})
