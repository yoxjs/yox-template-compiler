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

  tpl1 = `
  <div on-click="post($event, a, 3)" o-xxx="post($keypath, $length, a, 1)">
    {{$keypath}}
  </div>
  `

  tpl1 = `
  <div>
    {{$keypath}}
    <ul>
      {{#each list:outerIndex}}
        <li>
          {{$keypath}} + {{outerIndex}}

          {{#each this:innerIndex}}
            {{outerIndex}} + {{innerIndex}}
          {{/each}}
        </li>
      {{/each}}
    </ul>
  </div>
  `

  tpl1 = `
  <div>
  {{#each list:outerIndex}}
    {{this}} {{outerIndex}}
    <div on-click="post(this, $event, $data)"></div>

    {{#each 1->5:index}}
      {{this}} {{index}} {{outerIndex}}
      <div on-click="post(this, $event, $data)"></div>
    {{/each}}

    {{#each ['11', '111', '1111']:index}}
      {{this}} {{this.a.b}} {{index}} {{outerIndex}}
      <div on-click="post(this, $event, $data)"></div>
    {{/each}}
  {{/each}}
  </div>
  `

  tpl1 = `
  <div>
  {{format(1)}}
  {{a.format(1)}}
  {{this.format(1)}}
  {{a}}
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
