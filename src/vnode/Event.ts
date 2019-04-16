import EventObject from 'yox-common/util/Event'

/**
 * 事件指令
 */
export default interface Event {

  // 监听的事件名称
  name: string

  lazy: number | boolean

  handler: (event: EventObject, data: any) => void

}