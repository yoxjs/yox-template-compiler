import { compile } from '../src/compiler'
import { stringify } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div>
      123
      {{a}}
      cvcc
    </div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))

})