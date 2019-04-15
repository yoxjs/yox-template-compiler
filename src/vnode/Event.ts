/**
 * 事件指令
 */
export default interface Event {

  // 监听的事件名称
  name: string

  // 发出的事件名称
  event: string | void

  // 调用的方法名
  method: string | void

  // 调用参数
  args: Function | void

}