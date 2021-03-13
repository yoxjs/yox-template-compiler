import { compile } from 'yox-template-compiler/src/compiler'
import { generate } from 'yox-template-compiler/src/generator'

test('event', () => {

  // let tpl = `
  // <div ref="123" key="456" id="gag" data-ui="1">123{{a}}{{b}}</div>
  // `

  let tpl1 = `
  <div id="{{11}}" class="{{true}}" width="{{44}}" disabled="{{true}}" data-xx lazy lazy-xx="10" a="{{a}}x{{b}}" b="1{{#if c}}2{{else if d}}3{{c}}{{/if}}4"{{#if e}} c="1"{{/if}}>
    123
    <span>123</span>
    45{{a}}
    {{ {a:1,b:2} }}
  </div>
  `

  // tpl1 = `
  // <div>
  //   <CheckboxGroup>
  //   {{#each list}}
  //     <Checkbox>
  //       {{this.text}}
  //     </Checkbox>
  //   {{/each}}
  //   </CheckboxGroup>
  // </div>
  // `

  // 事件名转成驼峰
  let ast = generate(compile(tpl1)[0])

  console.log(ast)


})
