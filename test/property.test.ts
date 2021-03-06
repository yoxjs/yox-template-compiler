import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'
import * as config from 'yox-config/src/config'

import Element from 'yox-template-compiler/src/node/Element'
import Attribute from 'yox-template-compiler/src/node/Attribute'
import Property from 'yox-template-compiler/src/node/Property'

test('property', () => {

  // 布尔类型为 true，它的值只能是 属性名或 true，其他都是 false
  // height(number) 和 title(string) 属性因无值被忽略
  let ast = compile(`
    <div
      data-index="1"
      id="2"
      width="100"
      height
      title
      checked
      disabled="disabled"
      required="true"
      autofocus="false"
      muted="1"
      for="xx"
      data-literal1="{{true}}1"
      data-literal2="{{true}}1{{2}}"
      data-literal3="{{1}}{{2}}"
    ></div>
  `)

  expect(ast.length).toBe(1)

  const root = ast[0]
  expect(root.type).toBe(nodeType.ELEMENT)
  expect((root as Element).tag).toBe('div')
  expect((root as Element).isComponent).toBe(false)

  const { attrs } = ast[0] as Element
  expect(Array.isArray(attrs)).toBe(true)
  expect(root.children).toBe(undefined)

  if (attrs) {
    expect(attrs.length).toBe(12)

    expect(attrs[0].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[0] as Attribute).name).toBe('data-index')
    expect((attrs[0] as Attribute).value).toBe('1')
    expect((attrs[0] as Attribute).children).toBe(undefined)

    expect(attrs[1].type).toBe(nodeType.PROPERTY)
    expect((attrs[1] as Property).name).toBe('id')
    expect((attrs[1] as Property).hint).toBe(config.HINT_STRING)
    expect((attrs[1] as Property).value).toBe('2')
    expect((attrs[1] as Property).children).toBe(undefined)

    expect(attrs[2].type).toBe(nodeType.PROPERTY)
    expect((attrs[2] as Property).name).toBe('width')
    expect((attrs[2] as Property).hint).toBe(config.HINT_NUMBER)
    expect((attrs[2] as Property).value).toBe(100)
    expect((attrs[2] as Property).children).toBe(undefined)

    expect(attrs[3].type).toBe(nodeType.PROPERTY)
    expect((attrs[3] as Property).name).toBe('checked')
    expect((attrs[3] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[3] as Property).value).toBe(true)
    expect((attrs[3] as Property).children).toBe(undefined)

    expect(attrs[4].type).toBe(nodeType.PROPERTY)
    expect((attrs[4] as Property).name).toBe('disabled')
    expect((attrs[4] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[4] as Property).value).toBe(true)
    expect((attrs[4] as Property).children).toBe(undefined)

    expect(attrs[5].type).toBe(nodeType.PROPERTY)
    expect((attrs[5] as Property).name).toBe('required')
    expect((attrs[5] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[5] as Property).value).toBe(true)
    expect((attrs[5] as Property).children).toBe(undefined)

    expect(attrs[6].type).toBe(nodeType.PROPERTY)
    expect((attrs[6] as Property).name).toBe('autofocus')
    expect((attrs[6] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[6] as Property).value).toBe(false)
    expect((attrs[6] as Property).children).toBe(undefined)

    expect(attrs[7].type).toBe(nodeType.PROPERTY)
    expect((attrs[7] as Property).name).toBe('muted')
    expect((attrs[7] as Property).hint).toBe(config.HINT_BOOLEAN)
    expect((attrs[7] as Property).value).toBe(false)
    expect((attrs[7] as Property).children).toBe(undefined)


    expect(attrs[8].type).toBe(nodeType.PROPERTY)
    expect((attrs[8] as Property).name).toBe('htmlFor')
    expect((attrs[8] as Property).hint).toBe(config.HINT_STRING)
    expect((attrs[8] as Property).value).toBe('xx')
    expect((attrs[8] as Property).children).toBe(undefined)

    expect(attrs[9].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[9] as Attribute).name).toBe('data-literal1')
    expect((attrs[9] as Attribute).value).toBe('true1')
    expect((attrs[9] as Attribute).children).toBe(undefined)

    expect(attrs[10].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[10] as Attribute).name).toBe('data-literal2')
    expect((attrs[10] as Attribute).value).toBe('true12')
    expect((attrs[10] as Attribute).children).toBe(undefined)

    expect(attrs[11].type).toBe(nodeType.ATTRIBUTE)
    expect((attrs[11] as Attribute).name).toBe('data-literal3')
    expect((attrs[11] as Attribute).value).toBe('12')
    expect((attrs[11] as Attribute).children).toBe(undefined)

  }

})
