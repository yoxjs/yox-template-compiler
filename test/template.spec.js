
import compile from '../compile'

describe('template', () => {
  it('demo1', () => {

    let ast = compile('<div></div>')
    console.log(JSON.stringify(ast, 4, 4))

  })

})
