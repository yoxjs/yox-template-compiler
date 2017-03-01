# yox-template-compiler

Template compiler for Yox.js

```js
import * as templateCompiler from 'yox-template-compiler'

// Compile to AST
let nodes = templateCompiler.compile('<div>...</div>')

// Stringify from AST
// Maybe it is useful during the build phase
JSON.stringify(nodes)

nodes.forEach(
  function (node) {
    // render
    templateCompiler.render(
      node,
      createComment,
      createElement,
      importTemplate,
      data
    )
  }
)

``
