# yox-template-compiler

Template compiler for Yox.js

```js
import * as templateCompiler from 'yox-template-compiler'

// 编译成抽象语法树
let nodes = templateCompiler.compile('<div>...</div>')

// 构建阶段可序列化到文件
JSON.stringify(nodes)

nodes.forEach(
  function (node) {
    // 渲染
    templateCompiler.render(
      node,
      createComment,
      createText,
      createElement,
      importTemplate,
      data
    )
  }
)

``
