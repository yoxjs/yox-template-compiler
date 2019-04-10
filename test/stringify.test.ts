import { compile } from '../src/compiler'
import { stringify } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div
      id="id"
      class="class"
      xml:name="name"
      style="display:block;{{#if large}}width:100px{{else}}width:50px{{/if}};margin: {{px}}px"
      on-click="xx"
      on-mousedown="open()"
      on-mouseup="open(1, a)"
      o-log="yy"
    >
      <a>link</a>
      <b>strong</b>
      <input/>
    </div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))

})