/**
 * binding 指令
 */
export default interface Binding {

  /**
   * 绑定的属性名称，比如 <div id="{{xx}}" 中的 id
   */
  name: string

  /**
   * 是否是 attribute
   *
   * 单向绑定有三种场景：
   *
   * 对于组件来说，都是 prop
   * 对于 DOM 元素来说，需要区分 attr 和 prop
   *
   * 而 DOM 元素的 prop 有 hint 属性，用于区分值的类型，把 hint 放到这能获得信息最大化，既知道了是不是 dom prop，也知道了他的类型
   */
  hint: number | undefined

  binding: string

}