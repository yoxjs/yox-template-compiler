import { compile } from '../src/compiler'
import { stringify } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div
      id="id"
      class="class{{name}}1"
      xml:name="name"
      style="display:block;"
      on-click="xx"
      on-mousedown="open()"
      on-mouseup="open(1, a)"
      o-log="yy"
    >
      <span>1</span>
      <form></form>
    </div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))

})