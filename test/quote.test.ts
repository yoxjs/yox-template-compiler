import { compile } from 'yox-template-compiler/src/compiler'

test('必须有引号', () => {

  let hasError = false

  try {
    compile('<div class="11></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div class=1></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div class="11 name="xxx"></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

  hasError = false

  try {
    compile('<div class="11" name="xxx" "></div>')
  }
  catch (e) {
    hasError = true
  }

  expect(hasError).toBe(true)

})