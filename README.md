# yox-template-compiler

Template compiler for Yox.js

```js
import * as compiler from 'yox-template-compiler'

// Compile to AST
let ast = compiler.compile('<div>...</div>')

ast = compiler.convert(ast)

// render the first element
compiler.render(ast[ 0 ], getter, instance)
``

Stringify from AST

Maybe it is useful during the build phase

```js
JSON.stringify(
  ast.map(
    function (item) {
      return `function(a,b,c,e,i,m,o,p,s,x,y,z){return ${item.stringify()}}`
    }
  )
)
```
