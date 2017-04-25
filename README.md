# yox-template-compiler

Template compiler for Yox.js

```js
import compile from 'yox-template-compiler/compile'
import render from 'yox-template-compiler/render'

// Compile to AST
let ast = compile('<div>...</div>')

// Stringify from AST
// Maybe it is useful during the build phase
JSON.stringify(ast)

let { nodes, deps } = render(
  ast,
  data,
  createComment,
  createElement,
  importTemplate
)
``
