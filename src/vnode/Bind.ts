/**
 * bind 指令
 */
export default interface Bind {

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
   */
  isAttr: boolean

  /**
   * absoluteKeypath 可能为空
   * 比如 <div id="{{xx}}">，数据找不到 xx 时，absoluteKeypath为空
   */
  absoluteKeypath: string | void

  value: any | void

}