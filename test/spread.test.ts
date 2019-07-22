import { compile } from 'yox-template-compiler/src/compiler'

test('延展属性', () => {

  let hasError = false

  // 延展属性只能用于组件
  try {
    compile('<div {{...obj}}></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<Dog {{...obj}}></Dog>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(false)

  // 只能用于属性层级
  hasError = false

  try {
    compile('<Dog>{{...obj}}</Dog>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

})