
import compile from '../compile'

describe('template', () => {
  it('demo1', () => {

    //let ast = compile('<div><div></div></div>')
    let ast = compile('<div>123<div>456</div>789</div>')
    console.log(JSON.stringify(ast, 4, 4))

  })

})
