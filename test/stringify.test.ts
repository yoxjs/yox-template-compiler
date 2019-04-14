import { compile } from '../src/compiler'
import { render } from '../src/renderer'
import { stringify, convert } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div class="11" name="xxx" on-click="x" lazy-click>123{{a}}</div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result: any = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))

  // result = convert(result)

  // console.log(result.toString())
  // console.log(render(result))

})