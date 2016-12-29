# yox-template-compiler

Template compiler for yox.js

```js
import * as templateCompiler from 'yox-template-compiler'

// 编译成抽象语法树
let ast = templateCompiler.compile('<div>...</div>')

// 构建阶段可序列化到文件
JSON.stringify(ast)

// 渲染
templateCompiler.render(
  ast,
  createText,
  createElement,
  importTemplate,
  data
)
``
