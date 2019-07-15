import { compile } from '../src/compiler'
import * as nodeType from '../src/nodeType'
import * as config from 'yox-config/src/config'

import Text from '../src/node/Text'
import Element from '../src/node/Element'
import Attribute from '../src/node/Attribute'
import Property from '../src/node/Property'

test('property', () => {

  let ast = compile(`
    <div
      id="1"
      name="2"
      data-id="yox"
      data-name
      xml1:age="3"
      xml2:number="4"
      custom1
      custom2=""
    >
      5
    </div>
  `)

  expect(ast.length).toBe(1)

  const root = ast[0]
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('div')
  expect((root as Element).isComponent).toBe(false)

  const { attrs, children } = root as Element
  expect(Array.isArray(attrs)).toBe(true)
  expect(Array.isArray(children)).toBe(true)

  if (attrs && children) {

    expect(attrs.length).toBe(8)
    expect(children.length).toBe(1)

    expect(attrs[0].type).toBe(nodeType.PROPERTY)
    expect((attrs[0] as Property).name).toBe('id')
    expect((attrs[0] as Property).hint).toBe(config.HINT_STRING)
    expect((attrs[0] as Property).value).toBe('1')

    expect(attrs[1].type).toBe(nodeType.PROPERTY)
    expect((attrs[1] as Property).name).toBe('name')
    expect((attrs[1] as Property).hint).toBe(config.HINT_STRING)
    expect((attrs[1] as Property).value).toBe('2')

    expect(attrs[2].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[2] as Attribute).name).toBe('data-id')
    expect((attrs[2] as Attribute).value).toBe('yox')

    // data- 默认值是空字符串
    expect(attrs[3].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[3] as Attribute).name).toBe('data-name')
    expect((attrs[3] as Attribute).value).toBe('')

    expect(attrs[4].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[4] as Attribute).name).toBe('xml1:age')
    expect((attrs[4] as Attribute).value).toBe('3')

    expect(attrs[5].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[5] as Attribute).name).toBe('xml2:number')
    expect((attrs[5] as Attribute).value).toBe('4')

    // 无值，值为 name
    expect(attrs[6].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[6] as Attribute).name).toBe('custom1')
    expect((attrs[6] as Attribute).value).toBe('custom1')

    expect(attrs[7].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[7] as Attribute).name).toBe('custom2')
    expect((attrs[7] as Attribute).value).toBe('')

    expect(children[0].type).toBe(nodeType.TEXT)
    expect((children[0] as Text).text).toBe('5')

  }



})
