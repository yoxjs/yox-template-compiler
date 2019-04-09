import Branch from './Branch'

/**
 * 指令节点
 *
 * on-click="submit"  name 是 event, modifier 是 click
 *
 * @param name 指令名
 * @param modifier 指令修饰符
 */
export default interface Directive extends Branch {

  name: string

  modifier: string

}
