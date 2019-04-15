/**
 * model 指令
 */
export default interface Model {

  name: string

  /**
   * absoluteKeypath 可能为空
   * 比如 <div id="{{id}}">，数据里并没有 id
   */
  absoluteKeypath: string | void

  value: any | void

}