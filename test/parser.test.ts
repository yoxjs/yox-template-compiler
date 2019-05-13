
import { compile } from '../src/compiler'
import * as config from 'yox-config'
import * as nodeType from '../src/nodeType'

import * as exprNodeType from 'yox-expression-compiler/src/nodeType'

function checkValue(node: any, text: string) {
  if (node.children) {
    expect(node.children.length).toBe(1)
    expect(node.children[0].type).toBe(nodeType.TEXT)
    expect(node.children[0].text).toBe(text)
  }
  else {
    expect(node.value).toBe(text)
  }
}

it('空模板', () => {

  let ast1 = compile(' ')

  expect(ast1.length).toBe(1)
  expect(ast1[0].type).toBe(nodeType.TEXT)
  expect(ast1[0].text).toBe(' ')

  let ast2 = compile('')

  expect(ast2.length).toBe(0)

})

it('template 和 slot', () => {

  let hasError = false

  // template 必须搭配 slot 属性
  try {
    compile('<template></template>')
  }
  catch {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // template 必须在组件内使用
  try {
    compile('<template slot="xx"></template>')
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

  try {
    let ast = compile('<Dog><template slot="xx"></template></Dog>')
    expect(ast[0].children[0].slot != null).toBe(true)
    expect(ast[0].children[0].slot).toBe('xx')
    expect(ast[0].children[0].attrs).toBe(undefined)
  }
  catch (e) {
    hasError = true
  }
  expect(hasError).toBe(false)

})

it('支持多个根元素', () => {

  let ast = compile('<div></div><span></span><ul></ul>text')

  expect(ast.length).toBe(4)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('div')

  expect(ast[1].type).toBe(nodeType.ELEMENT)
  expect(ast[1].tag).toBe('span')

  expect(ast[2].type).toBe(nodeType.ELEMENT)
  expect(ast[2].tag).toBe('ul')

  expect(ast[3].type).toBe(nodeType.TEXT)
  expect(ast[3].text).toBe('text')
})

it('复杂节点和简单节点', () => {

  let ast: any

  ast = compile('<div></div>')

  expect(!!ast[0].isComplex).toBe(false)

  ast = compile('<span id="xx">{{x}}</span>')

  expect(!!ast[0].isComplex).toBe(false)
  expect(!!ast[0].attrs[0].isComplex).toBe(false)

  ast = compile('<span id="x{{x}}x"></span>')

  expect(!!ast[0].isComplex).toBe(false)
  expect(!!ast[0].attrs[0].isComplex).toBe(false)

  ast = compile('<span id="x{{x}}x{{#if x}}1{{else}}2{{/if}}"></span>')

  expect(!!ast[0].isComplex).toBe(false)
  expect(!!ast[0].attrs[0].isComplex).toBe(false)

  ast = compile('<span>x{{x}}x{{#if x}}1{{else}}2{{/if}}</span>')

  expect(!!ast[0].isComplex).toBe(false)

  ast = compile('<span>x{{x}}x{{#if x}}<input>{{else}}2{{/if}}</span>')

  expect(!!ast[0].isComplex).toBe(true)

  ast = compile('<span>x{{x}}x{{#each a}}123{{/each}}</span>')

  expect(!!ast[0].isComplex).toBe(true)

  ast = compile('<span>x{{x}}x{{#partial a}}123{{/partial}}</span>')

  expect(!!ast[0].isComplex).toBe(true)

  ast = compile('<span>x{{x}}x{{> a}}</span>')

  expect(!!ast[0].isComplex).toBe(true)

})

it('静态子树', () => {

  let ast: any

  ast = compile('<div><span id="xx">1123</span></div>')

  expect(ast[0].isStatic).toBe(true)
  expect(ast[0].children[0].isStatic).toBe(true)

  ast = compile('<div><span id="xx">{{x}}</span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile('<div><span id="xx">{{#if x}}x{{/if}}</span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile('<div><span id="xx">{{> name}}</span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile('<div><span id="{{x}}"></span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile('<div><span on-click="x"></span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile('<div><span o-x="x"></span></div>')

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)

  ast = compile(`
    <div>
      <div>xx</div>
      <div>{{x}}</div>
    </div>
  `)

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(true)
  expect(ast[0].children[1].isStatic).toBe(false)

  ast = compile(`
    <div>
      <slot name="xx"/>
      <div>{{x}}</div>
    </div>
  `)

  expect(ast[0].isStatic).toBe(false)
  expect(ast[0].children[0].isStatic).toBe(false)
  expect(ast[0].children[1].isStatic).toBe(false)

})

it('svg', () => {

  let ast: any

  ast = compile('<svg></svg')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('svg')
  expect(ast[0].isSvg).toBe(true)
  expect(ast[0].isComponent).toBe(false)

  ast = compile('<font-face></font-face')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('font-face')
  expect(ast[0].isSvg).toBe(true)
  expect(ast[0].isComponent).toBe(false)

  ast = compile('<missing-glyph></missing-glyph')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('missing-glyph')
  expect(ast[0].isSvg).toBe(true)
  expect(ast[0].isComponent).toBe(false)

  ast = compile('<foreignObject></foreignObject')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('foreignObject')
  expect(ast[0].isSvg).toBe(true)
  expect(ast[0].isComponent).toBe(false)

})

it('style', () => {

  let ast: any

  ast = compile('<style></style>')

  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('style')
  expect(ast[0].isStyle).toBe(true)
  expect(ast[0].isComponent).toBe(false)

})

it('匹配开始结束标签', () => {

  let hasError = false

  try {
    compile('<div></span>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div><a></b></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

})

it('简单的标签组合', () => {

  let ast = compile('<div>123<span>456</span>789</div>')
  expect(ast.length).toBe(1)

  expect(ast[0].type).toBe(nodeType.ELEMENT)
  expect(ast[0].tag).toBe('div')

  expect(ast[0].children.length).toBe(3)

  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('123')

  expect(ast[0].children[1].type).toBe(nodeType.ELEMENT)
  expect(ast[0].children[1].tag).toBe('span')
  expect(ast[0].children[1].children.length).toBe(1)
  expect(ast[0].children[1].attrs).toBe(undefined)

  expect(ast[0].children[2].type).toBe(nodeType.TEXT)
  expect(ast[0].children[2].text).toBe('789')
})

it('延展属性', () => {

  let hasError = false

  // 延展属性只能用于组件
  try {
    compile('<div {{...obj}}></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<Dog {{...obj}}></Dog>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

  // 只能用于属性层级
  hasError = false

  try {
    compile('<Dog>{{...obj}}</Dog>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

})

it('属性引号', () => {

  let hasError = false

  try {
    compile('<div class="11></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div class="11 name="xxx"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div class="11" name="xxx" "></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

})

it('attribute', () => {

  let ast = compile('<div id="1" name="2" xml1:age="3" xml2:number="4">5</div>')

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(4)
  expect(ast[0].children.length).toBe(1)

  expect(ast[0].attrs[0].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[0].name).toBe('id')
  checkValue(ast[0].attrs[0], '1')

  expect(ast[0].attrs[1].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[1].name).toBe('name')
  checkValue(ast[0].attrs[1], '2')

  expect(ast[0].attrs[2].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[2].name).toBe('xml1:age')
  checkValue(ast[0].attrs[2], '3')

  expect(ast[0].attrs[3].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[3].name).toBe('xml2:number')
  checkValue(ast[0].attrs[3], '4')

  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('5')

})

it('property', () => {

  // 布尔类型为 true，它的值只能是 属性名或 true，其他都是 false
  let ast = compile('<div data-index="1" id="2" width="100" checked disabled="disabled" required="true" autofocus="false" muted="1" for="xx"></div>')

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(9)
  expect(ast[0].children).toBe(undefined)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('data-index')
  checkValue(ast[0].attrs[0], '1')

  expect(ast[0].attrs[1].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[1].name).toBe('id')
  expect(ast[0].attrs[1].hint).toBe(config.HINT_STRING)
  checkValue(ast[0].attrs[1], '2')

  expect(ast[0].attrs[2].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[2].name).toBe('width')
  expect(ast[0].attrs[2].hint).toBe(config.HINT_NUMBER)
  checkValue(ast[0].attrs[2], 100)

  expect(ast[0].attrs[3].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[3].name).toBe('checked')
  expect(ast[0].attrs[3].hint).toBe(config.HINT_BOOLEAN)
  checkValue(ast[0].attrs[3], true)

  expect(ast[0].attrs[4].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[4].name).toBe('disabled')
  expect(ast[0].attrs[4].hint).toBe(config.HINT_BOOLEAN)
  checkValue(ast[0].attrs[4], true)

  expect(ast[0].attrs[5].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[5].name).toBe('required')
  expect(ast[0].attrs[5].hint).toBe(config.HINT_BOOLEAN)
  checkValue(ast[0].attrs[5], true)

  expect(ast[0].attrs[6].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[6].name).toBe('autofocus')
  expect(ast[0].attrs[6].hint).toBe(config.HINT_BOOLEAN)
  checkValue(ast[0].attrs[6], false)

  expect(ast[0].attrs[7].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[7].name).toBe('muted')
  expect(ast[0].attrs[7].hint).toBe(config.HINT_BOOLEAN)
  checkValue(ast[0].attrs[7], false)

  expect(ast[0].attrs[8].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[8].name).toBe('htmlFor')
  expect(ast[0].attrs[8].hint).toBe(config.HINT_STRING)
  checkValue(ast[0].attrs[8], 'xx')

})

it('event', () => {

  let hasError = false

  try {
    compile('<div on-=></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 只能调用 methods 定义的方法
  try {
    compile('<div on-click="a.b()"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="123"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)



  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="[]"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 只能是 name.namespace
  try {
    compile('<div on-tap="a.b.c"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)




  hasError = false

  // 事件名只能用标识符和命名空间的标识符
  try {
    compile('<div on-tap="list.0"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)





  hasError = false

  // 可以是一个字母
  try {
    compile('<div on-click="x"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

  hasError = false

  // 可以是单词
  try {
    compile('<div on-click="submit"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

  hasError = false

  // 可以是一个字母
  try {
    compile('<div on-click="x.y"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)


  hasError = false

  // 可以是单词
  try {
    compile('<div on-click="name.namespace"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)


  hasError = false

  // dom 可以转换相同的事件
  try {
    compile('<div on-click="click"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)



  hasError = false

  // 组件不能转换相同的事件
  try {
    compile('<Component on-click="click"></Component>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 转换后的名称不是连字符
  try {
    compile('<Component on-click="test-case"></Component>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  // 事件名转成驼峰
  let ast = compile('<Component on-get-out="click"></Component>')

  expect(ast[0].attrs.length).toBe(1)
  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].name).toBe('getOut')

  // 命名空间
  ast = compile('<Button on-submit.button="click"></Button>')

  expect(ast[0].attrs.length).toBe(1)
  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].name).toBe('submit.button')

  // 转驼峰
  ast = compile('<Button on-submit-test.button-test="click"></Button>')

  expect(ast[0].attrs.length).toBe(1)
  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].name).toBe('submitTest.buttonTest')

})

it('directive', () => {

  let hasError = false

  // model 只能用标识符或 memeber
  try {
    compile('<div model="11"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // model 只能用标识符或 memeber
  try {
    compile('<div model="a()"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  // model 只能用标识符或 memeber
  try {
    compile('<div model="true"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // 函数调用只能用标识符
  try {
    compile('<div o-tap="a.b()"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // template 上只能写 slot
  try {
    compile('<Dog><template slot="11" key="1"></template></Dog>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)


  hasError = false

  // lazy 只能是大于 0 的数字或没值
  try {
    compile('<div lazy="a"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // lazy 只能是大于 0 的数字或没值
  try {
    compile('<div lazy="0"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // lazy 只能是大于 0 的数字或没值
  try {
    compile('<div lazy="-1"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // 指令不能用插值语法
  try {
    compile('<div lazy="{{a}}"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)


  let ast: any

  ast = compile('<div lazy></div>')

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(1)

  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].ns).toBe(config.DIRECTIVE_LAZY)
  expect(ast[0].attrs[0].value).toBe(true)

  ast = compile('<div o-a></div>')

  expect(ast.length).toBe(1)

  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].ns).toBe(config.DIRECTIVE_CUSTOM)
  expect(ast[0].attrs[0].value).toBe(true)



  hasError = false

  // 转换事件只能用标识符
  try {
    compile('<div on-click="123"></div>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  // 转换组件事件名称不能相同
  try {
    compile('<Dog on-click="click"/>')
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

})

it('文本换行', () => {

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
  expect(ast[0].attrs.length).toBe(4)
  expect(ast[0].children.length).toBe(1)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('a')
  checkValue(ast[0].attrs[0], '1')

  expect(ast[0].attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[1].name).toBe('b')
  checkValue(ast[0].attrs[1], '2')

  expect(ast[0].attrs[2].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[2].name).toBe('c')
  checkValue(ast[0].attrs[2], '3')

  expect(ast[0].attrs[3].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[3].name).toBe('d')
  checkValue(ast[0].attrs[3], '4')

  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('5\n      6')

})

it('自动 binding', () => {

  let ast = compile(`
    <div id="{{id}}" class="{{a.b.c}}" name="{{a + b}}" title="1"></div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(4)
  expect(ast[0].children).toBe(undefined)

  expect(ast[0].attrs[0].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[0].name).toBe('id')
  expect(ast[0].attrs[0].binding).toBe(true)

  expect(ast[0].attrs[1].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[1].name).toBe('className')
  expect(ast[0].attrs[1].binding).toBe(true)

  expect(ast[0].attrs[2].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[2].name).toBe('name')

  expect(ast[0].attrs[3].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[3].name).toBe('title')
  expect(ast[0].attrs[3].value).toBe('1')

})

it('lazy 指令自动转型', () => {

  let ast: any

  ast = compile(`
    <div lazy></div>
  `)

  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].ns).toBe(config.DIRECTIVE_LAZY)
  expect(ast[0].attrs[0].name).toBe('')
  expect(ast[0].attrs[0].expr).toBe(undefined)
  expect(ast[0].attrs[0].value).toBe(true)


  ast = compile(`
    <div lazy="100"></div>
  `)

  expect(ast[0].attrs[0].type).toBe(nodeType.DIRECTIVE)
  expect(ast[0].attrs[0].ns).toBe(config.DIRECTIVE_LAZY)
  expect(ast[0].attrs[0].name).toBe('')
  expect(ast[0].attrs[0].expr).toBe(undefined)
  expect(ast[0].attrs[0].value).toBe(100)

  let hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="0"></div>')
  }
  catch {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="-1"></div>')
  }
  catch {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy="haha"></div>')
  }
  catch {
    hasError = true
  }
  expect(hasError).toBe(true)

  hasError = false

  // 必须大于 0
  try {
    compile('<div lazy=""></div>')
  }
  catch {
    hasError = true
  }
  expect(hasError).toBe(true)

})

it('默认属性值', () => {

  let ast = compile(`
    <div a b="">1</div>
  `)

  expect(ast.length).toBe(1)
  expect(ast[0].attrs.length).toBe(2)
  expect(ast[0].children.length).toBe(1)

  expect(ast[0].attrs[0].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[0].name).toBe('a')
  checkValue(ast[0].attrs[0], 'a')

  expect(ast[0].attrs[1].type).toBe(nodeType.ATTRIBUTE)
  expect(ast[0].attrs[1].name).toBe('b')
  checkValue(ast[0].attrs[1], '')

  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('1')

})

it('非转义插值', () => {

  let ast1 = compile(`
    <div>{{a}}</div>
  `)

  expect(ast1.length).toBe(1)
  expect(ast1[0].attrs).toBe(undefined)
  expect(ast1[0].children.length).toBe(1)

  expect(ast1[0].children[0].type).toBe(nodeType.EXPRESSION)
  expect(typeof ast1[0].children[0].expr).toBe('object')

  let ast2 = compile(`
    <div>{{{a}}}</div>
  `)

  expect(ast2.length).toBe(1)
  expect(ast2[0].attrs).toBe(undefined)
  expect(ast2[0].children).toBe(undefined)

  expect(typeof ast2[0].html).toBe('object')

})

it('自闭合标签', () => {

  let ast1 = compile('<div><br/></div>')
  expect(ast1.length).toBe(1)

  expect(ast1[0].type).toBe(nodeType.ELEMENT)
  expect(ast1[0].tag).toBe('div')

  expect(ast1[0].children.length).toBe(1)

  expect(ast1[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast1[0].children[0].tag).toBe('br')

  let ast2 = compile('<div><br></div>')
  expect(ast2.length).toBe(1)

  expect(ast2[0].type).toBe(nodeType.ELEMENT)
  expect(ast2[0].tag).toBe('div')

  expect(ast2[0].children.length).toBe(1)

  expect(ast2[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast2[0].children[0].tag).toBe('br')

  let ast3 = compile('<div><br>1</div>')
  expect(ast3.length).toBe(1)

  expect(ast3[0].type).toBe(nodeType.ELEMENT)
  expect(ast3[0].tag).toBe('div')

  expect(ast3[0].children.length).toBe(2)

  expect(ast3[0].children[0].type).toBe(nodeType.ELEMENT)
  expect(ast3[0].children[0].tag).toBe('br')

  expect(ast3[0].children[1].type).toBe(nodeType.TEXT)
  expect(ast3[0].children[1].text).toBe('1')

})

it('if', () => {

  let ast: any

  ast = compile('{{#if x > 1}}a{{else if x < 0}}b{{else}}c{{/if}}')

  expect(ast.length).toBe(1)
  expect(ast[0].type).toBe(nodeType.IF)
  expect(ast[0].children.length).toBe(1)
  expect(ast[0].children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].children[0].text).toBe('a')

  expect(ast[0].next.type).toBe(nodeType.ELSE_IF)
  expect(ast[0].next.children.length).toBe(1)
  expect(ast[0].next.children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].next.children[0].text).toBe('b')

  expect(ast[0].next.next.type).toBe(nodeType.ELSE)
  expect(ast[0].next.next.children.length).toBe(1)
  expect(ast[0].next.next.children[0].type).toBe(nodeType.TEXT)
  expect(ast[0].next.next.children[0].text).toBe('c')

  ast = compile('{{#if x > 1}}a{{else if x < 0}}{{else}}c{{/if}}')
  expect(ast[0].next.children).toBe(undefined)

  let hasError = false

  try {
    ast = compile('{{#if x > 1}}{{else if x < 0}}{{else}}{{/if}}')
    expect(ast.length).toBe(0)
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

  hasError = false

  try {
    ast = compile('{{#if x > 1}}{{/if}}')
    expect(ast.length).toBe(0)
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

})

it('each', () => {

  let ast: any, hasError = false

  try {
    ast = compile(`
      <div>
        {{#each x}}{{/each}}
      </div>
    `)
    expect(ast[0].children).toBe(undefined)
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

})

it('partial', () => {

  let ast: any, hasError = false

  try {
    ast = compile(`
      <div>
        {{#partial x}}{{/partial}}
      </div>
    `)
    expect(ast[0].children).toBe(undefined)
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(false)

})


it('结构完整', () => {

  let ast: any, hasError = false

  try {
    ast = compile(`
      <div>
        {{#if a}}
          1
        {{else}}
          2
    `)
  }
  catch {
    hasError = true
  }

  expect(hasError).toBe(true)

})

it('对象字面量', () => {

  let ast = compile(`
    <div>
      {{ { name: 'yox' } }}
    </div>
  `)

  expect(ast[0].children.length).toBe(1)
  expect(ast[0].children[0].type).toBe(nodeType.EXPRESSION)
  expect(ast[0].children[0].safe).toBe(true)
  expect(ast[0].children[0].expr.type).toBe(exprNodeType.OBJECT)
})

it('html 注释', () => {

  let ast = compile(`
    <div id="<!-- xxx -->">
      <!-- 1 -->
      <!-- 2 -->
    </div>
  `)

  expect(ast[0].children).toBe(undefined)
  expect(ast[0].attrs.length).toBe(1)
  expect(ast[0].attrs[0].type).toBe(nodeType.PROPERTY)
  expect(ast[0].attrs[0].value).toBe('<!-- xxx -->')

})