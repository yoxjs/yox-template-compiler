/**
 * binding 指令
 */
export default interface Binding {

  /**
   * 绑定的属性名称，比如 <div id="{{xx}}" 中的 id
   */
  name: string

  binding: string

  /**
   * dom prop
   */
  hint: number | undefined

}