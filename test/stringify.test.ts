import { compile } from '../src/compiler'
import { render } from '../src/renderer'
import { stringify } from '../src/stringify'

it('html 元素', () => {

  let ast = compile(`
    <div>
  <!-- 反转字符串 -->
  {{title.split('').reverse().join('')}}
</div>
  `)

  console.log(JSON.stringify(ast, 4, 4))

  let result: any = stringify(ast[0])

  console.log(JSON.stringify(result, 4, 4))




})