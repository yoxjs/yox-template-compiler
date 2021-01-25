import { compile } from 'yox-template-compiler/src/compiler'
import * as nodeType from 'yox-template-compiler/src/nodeType'
import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

import Node from 'yox-template-compiler/src/node/Node'
import Element from 'yox-template-compiler/src/node/Element'
import Property from 'yox-template-compiler/src/node/Property'
import Expression from 'yox-template-compiler/src/node/Expression'
import Text from 'yox-template-compiler/src/node/Text'


test('匹配开始结束标签', () => {

  let hasError = false

  try {
    compile('<div></span>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div><a></b></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  try {
    compile(`
      <div>
        {{#if a}}
          1
        {{else}}
          2
    `)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


})

test('简单的标签组合', () => {

  let ast = compile('<div>123<span>456</span>789</div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  const children = ast[0].children
  expect(children != null).toBe(true)
  if (children) {
    expect(children.length).toBe(3)

    expect(children[0].type).toBe(nodeType.TEXT)
    expect((children[0] as Text).text).toBe('123')

    expect(children[1].type).toBe(nodeType.ELEMENT)
    expect((children[1] as Element).tag).toBe('span')
    expect((children[1] as Element).children).toBe(undefined)
    expect((children[1] as Element).attrs).toBe(undefined)
    expect((children[1] as Element).html).toBe(undefined)
    expect((children[1] as Element).text).toBe('456')

    expect(children[2].type).toBe(nodeType.TEXT)
    expect((children[2] as Text).text).toBe('789')
  }
})

test('style', () => {

  let ast = compile('<style></style>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('style')
  expect((ast[0] as Element).isStyle).toBe(true)
  expect((ast[0] as Element).isComponent).toBe(false)

  // 为了兼容 IE，必须加 type 属性
  const { attrs } = ast[0] as Element
  expect(Array.isArray(attrs)).toBe(true)
  if (attrs) {
    expect(attrs.length).toBe(1)
    expect(attrs[0].type).toBe(nodeType.PROPERTY)
    expect((attrs[0] as Property).name).toBe('type')
    expect((attrs[0] as Property).value).toBe('text/css')
  }

})

test('option', () => {

  let ast = compile('<select><option>1</option></select>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('select')
  expect((ast[0] as Element).isComponent).toBe(false)

  // 为了兼容 IE，必须给 option 加 isOption 为 true
  const { children } = ast[0] as Element
  expect(Array.isArray(children)).toBe(true)
  if (children) {
    expect(children.length).toBe(1)
    expect(children[0].type).toBe(nodeType.ELEMENT)
    expect((children[0] as Element).tag).toBe('option')
    expect((children[0] as Element).isOption).toBe(true)
  }

})

test('template', () => {

  let hasError = false

  // template 必须在组件内使用
  try {
    compile('<template slot="xx"></template>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // template 必须搭配 slot 属性
  try {
    compile('<Dog><template></template></Dog>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // slot 不能用插值
  try {
    compile('<Dog><template slot="{{a}}"></template></Dog>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // slot 不能是空字符串
  try {
    compile('<Dog><template slot=""></template></Dog>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // slot 不能不写值
  try {
    compile('<Dog><template slot></template></Dog>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // slot 不能位于 if 内
  try {
    compile('<Dog><template {{#if a}}slot="xx"{{/if}}></template></Dog>')
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // template 上只能写 slot
  try {
    compile('<Dog><template slot="11" key="1"></template></Dog>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)


  let ast = compile('<Dog><template slot="xx">11</template></Dog>')
  let { children } = ast[0]
  expect(children != null).toBe(true)
  if (children) {
    expect(children[0].type).toBe(nodeType.ELEMENT)
    expect((children[0] as Element).slot != null).toBe(true)
    expect((children[0] as Element).slot).toBe('xx')
    expect((children[0] as Element).attrs).toBe(undefined)
    expect(Array.isArray((children[0] as Element).children)).toBe(true)
  }

})

test('空的 template', () => {
  let ast = compile('<Dog><template slot="xx"></template></Dog>')
  expect(ast[0].children).toBe(undefined)
})

test('静态元素', () => {

  let ast = compile('<div><span id="xx">1123</span></div>')

  expect(ast[0].isStatic).toBe(true)
  expect((ast[0].children as Node[])[0].isStatic).toBe(true)

  ast = compile('<div><span id="xx">{{x}}</span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile('<div><span id="xx">{{#if x}}x{{/if}}</span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile('<div><span id="xx">{{> name}}</span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile('<div><span id="{{x}}"></span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile('<div><span on-click="x"></span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile('<div><span o-x="x"></span></div>')
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)

  ast = compile(`
    <div>
      <div>xx</div>
      <div>{{x}}</div>
    </div>
  `)
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(true)
  expect((ast[0].children as Node[])[1].isStatic).toBe(false)

  ast = compile(`
    <div>
      <slot name="xx"/>
      <div>{{x}}</div>
    </div>
  `)

  expect(ast[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[0].isStatic).toBe(false)
  expect((ast[0].children as Node[])[1].isStatic).toBe(false)

})


test('标签名后加 if', () => {

  let ast = compile(`
    <div{{#if xx}} id="xx"{{/if}}>
    </div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].isStatic).toBe(false)
  expect((ast[0] as Element).tag).toBe('div')

  let attrs = (ast[0] as Element).attrs as Node[]
  expect(attrs.length).toBe(1)
  expect(attrs[0].type).toBe(nodeType.IF)

})


test('自闭合标签', () => {

  let ast = compile('<div><br/></div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)

  let root = ast[0] as Element
  expect(root.tag).toBe('div')

  let children = root.children as Node[]
  expect(children.length).toBe(1)

  expect(children[0].type).toBe(nodeType.ELEMENT)
  expect((children[0] as Element).tag).toBe('br')



  ast = compile('<div><br></div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)

  root = ast[0] as Element
  expect(root.tag).toBe('div')

  children = root.children as Node[]
  expect(children.length).toBe(1)

  expect(children[0].type).toBe(nodeType.ELEMENT)
  expect((children[0] as Element).tag).toBe('br')


  ast = compile('<div><br>1</div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)

  root = ast[0] as Element
  expect(root.tag).toBe('div')

  children = root.children as Node[]
  expect(children.length).toBe(2)

  expect(children[0].type).toBe(nodeType.ELEMENT)
  expect((children[0] as Element).tag).toBe('br')

  expect(children[1].type).toBe(nodeType.TEXT)
  expect((children[1] as Text).text).toBe('1')

})

test('元素内容的字面量合并', () => {

  let ast = compile('<div>{{1}}2{{a}}</div>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(2)
  expect(children[0].type).toBe(nodeType.TEXT)
  expect((children[0] as Text).text).toBe('12')

  expect(children[1].type).toBe(nodeType.EXPRESSION)
  expect((children[1] as Expression).expr.type).toBe(exprNodeType.IDENTIFIER)

})

test('元素只有一个文本子节点', () => {

  let ast = compile('<div>123</div>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  expect((ast[0] as Element).text).toBe('123')
  expect((ast[0] as Element).html).toBe(undefined)
  expect((ast[0] as Element).children).toBe(undefined)

  ast = compile('<div>1&nbsp;2</div>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  expect((ast[0] as Element).html).toBe('1&nbsp;2')
  expect((ast[0] as Element).text).toBe(undefined)
  expect((ast[0] as Element).children).toBe(undefined)

})

test('元素只有一个表达式子节点', () => {

  let ast = compile('<div>{{a}}</div>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')
  expect((ast[0] as Element).text).toBe(undefined)
  expect((ast[0] as Element).html).toBe(undefined)

  let children = (ast[0] as Element).children as Node[]
  expect(children.length).toBe(1)
  expect(children[0].type).toBe(nodeType.EXPRESSION)


  ast = compile('<div>{{{a}}}</div>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')
  expect((ast[0] as Element).text).toBe(undefined)
  expect(typeof (ast[0] as Element).html).toBe('object')
  // expect((ast[0] as Element).html.type).toBe(exprNodeType.IDENTIFIER)


})

test('支持多个根元素', () => {

  let ast = compile('<div></div><span></span><ul></ul>text')

  expect(ast.length).toBe(4)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect((ast[0] as Element).tag).toBe('div')

  expect(ast[1].type).toBe(nodeType.ELEMENT)
  expect((ast[1] as Element).tag).toBe('span')

  expect(ast[2].type).toBe(nodeType.ELEMENT)
  expect((ast[2] as Element).tag).toBe('ul')

  expect(ast[3].type).toBe(nodeType.TEXT)
  expect((ast[3] as Text).text).toBe('text')
})