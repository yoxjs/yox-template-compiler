import { compile } from '../src/compiler'
import { render } from '../src/renderer'
import { stringify, parse } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div id="1{{#if a}}1{{else}}2{{/if}}">
      1
      {{#each a}}
        2
        <input>
      {{/each}}
      3
    </div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result: any = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))




})