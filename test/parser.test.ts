
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