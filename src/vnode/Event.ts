/**
 * 事件指令
 */
export default interface Event {

  // 监听的事件名称
  name: string

  lazy: number | boolean

  listener: Function

}