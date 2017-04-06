
import compile from '../compile'
import * as nodeType from '../src/nodeType'

describe('template', () => {

  it('支持多个根元素', () => {

    let ast = compile('<div></div><span></span><ul></ul>text')

    expect(ast.length).toBe(4)

    expect(ast[0].type).toBe(nodeType.ELEMENT)
    expect(ast[0].name).toBe('div')

    expect(ast[1].type).toBe(nodeType.ELEMENT)
    expect(ast[1].name).toBe('span')

    expect(ast[2].type).toBe(nodeType.ELEMENT)
    expect(ast[2].name).toBe('ul')

    expect(ast[3].type).toBe(nodeType.TEXT)
    expect(ast[3].content).toBe('text')
  })

  it('简单的标签组合', () => {

    let ast = compile('<div>123<span>456</span>789</div>')
    expect(ast.length).toBe(1)

    expect(ast[0].type).toBe(nodeType.ELEMENT)
    expect(ast[0].name).toBe('div')

    expect(ast[0].children.length).toBe(3)

    expect(ast[0].children[0].type).toBe(nodeType.TEXT)
    expect(ast[0].children[0].content).toBe('123')

    expect(ast[0].children[1].type).toBe(nodeType.ELEMENT)
    expect(ast[0].children[1].name).toBe('span')
    expect(ast[0].children[1].children.length).toBe(1)
    expect(ast[0].children[1].children[0].type).toBe(nodeType.TEXT)
    expect(ast[0].children[1].children[0].content).toBe('456')

    expect(ast[0].children[2].type).toBe(nodeType.TEXT)
    expect(ast[0].children[2].content).toBe('789')
  })

  it('自闭合标签', () => {


    let ast = compile('<div><br/></div>')
    expect(ast.length).toBe(1)

    expect(ast[0].type).toBe(nodeType.ELEMENT)
    expect(ast[0].name).toBe('div')

    expect(ast[0].children.length).toBe(1)

    expect(ast[0].children[0].type).toBe(nodeType.ELEMENT)
    expect(ast[0].children[0].name).toBe('br')

  })

})
