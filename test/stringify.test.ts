import { compile } from '../src/compiler'
import { stringify } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <Dog name="xx" age="{{age}}" class="1{{class}}2" on-click="xx">
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))

})