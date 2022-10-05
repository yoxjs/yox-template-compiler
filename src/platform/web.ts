import * as is from 'yox-common/src/util/is'
import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as logger from 'yox-common/src/util/logger'
import * as constant from 'yox-common/src/util/constant'

import ExpressionNode from 'yox-expression-compiler/src/node/Node'

import Element from '../node/Element'
import Attribute from '../node/Attribute'
import Style from '../node/Style'

import * as creator from '../creator'
import * as nodeType from '../nodeType'

import toString from 'yox-common/src/function/toString'

function split2Map(str: string) {
  const map = Object.create(constant.NULL)
  array.each(
    str.split(','),
    function (item) {
      map[item] = constant.TRUE
    }
  )
  return map
}

const needCompile = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production',

// 首字母大写，或中间包含 -
componentNamePattern = /^[A-Z]|-/,

// HTML 实体（中间最多 6 位，没见过更长的）
htmlEntityPattern = /&[#\w\d]{2,6};/,

// 常见的自闭合标签
selfClosingTagNames = needCompile ? split2Map('area,base,embed,track,source,param,input,col,img,br,hr') : constant.EMPTY_OBJECT,

// 常见的 svg 标签
svgTagNames = needCompile ? split2Map('svg,g,defs,desc,metadata,symbol,use,image,path,rect,circle,line,ellipse,polyline,polygon,text,tspan,tref,textpath,marker,pattern,clippath,mask,filter,cursor,view,animate,font,font-face,glyph,missing-glyph,animateColor,animateMotion,animateTransform,textPath,foreignObject') : constant.EMPTY_OBJECT,

// 常见的数字类型的属性（width,height,cellpadding,cellspacing 支持百分比，因此不计入数字类型）
numberAttributeNames = needCompile ? split2Map('min,minlength,max,maxlength,step,size,rows,cols,tabindex,colspan,rowspan,frameborder') : constant.EMPTY_OBJECT,

// 常见的布尔类型的属性
booleanAttributeNames = needCompile ? split2Map('disabled,checked,required,multiple,readonly,autofocus,autoplay,reversed,selected,controls,default,loop,muted,novalidate,draggable,contenteditable,hidden,spellcheck,allowfullscreen') : constant.EMPTY_OBJECT

export function isSelfClosing(tagName: string) {
  return selfClosingTagNames[tagName] !== constant.UNDEFINED
}

export function createAttribute(element: Element, name: string, ns: string | void): Attribute | Style {

  // 组件用驼峰格式
  if (element.isComponent) {
    return creator.createAttribute(
      string.camelize(name),
      ns
    )
  }

  // 原生 dom 属性
  if (name === 'style') {
    return creator.createStyle()
  }

  const attribute = creator.createAttribute(name, ns)
  if (isBooleanNativeAttribute(name)) {
    // 默认为 true 的布尔属性只有以下两种情况
    attribute.defaultValue = name === 'spellcheck'
      || (element.tag === 'img' && name === 'draggable')
  }

  return attribute

}

export function getAttributeDefaultValue(element: Element, name: string, defaultValue: any) {
  // 比如 <Dog isLive>
  if (element.isComponent) {
    return constant.TRUE
  }
  // 无视 <input min> 无效写法
  if (isNumberNativeAttribute(name)) {
    return constant.UNDEFINED
  }
  // 布尔类型取决于 defaultValue
  if (isBooleanNativeAttribute(name)) {
    return formatBooleanNativeAttributeValue(name, constant.TRUE, defaultValue)
  }
  // 字符串类型返回空字符串
  return constant.EMPTY_STRING
}

export function formatNativeAttributeValue(name: string, value: any, defaultValue: any) {

  if (isNumberNativeAttribute(name)) {
    return formatNumberNativeAttributeValue(name, value)
  }
  else if (isBooleanNativeAttribute(name)) {
    return formatBooleanNativeAttributeValue(name, value, defaultValue)
  }
  // 字符串类型的属性，保持原样即可
  return value

}

export function isNumberNativeAttribute(name: string) {
  return numberAttributeNames[name]
}

export function isBooleanNativeAttribute(name: string) {
  return booleanAttributeNames[name]
}

export function formatNumberNativeAttributeValue(name: string, value: any) {
  // 数字类型需要严格校验格式，比如 width="100%" 要打印报错信息，提示用户类型错误
  if (process.env.NODE_ENV === 'development') {
    if (!is.numeric(value)) {
      logger.warn(`The value of "${name}" is not a number: ${value}.`)
    }
  }
  return toString(value)
}

export function formatBooleanNativeAttributeValue(name: string, value: any, defaultValue: any) {

  // 布尔类型的属性，只有值为 true 或 属性名 才表示 true
  const isTrue = value === constant.TRUE || value === constant.RAW_TRUE || value === name

  return isTrue === defaultValue
    ? constant.UNDEFINED
    : (isTrue ? constant.RAW_TRUE : constant.RAW_FALSE)

}

export function createElement(staticTag: string, dynamicTag: ExpressionNode | void) {

  let isSvg = constant.FALSE, isStyle = constant.FALSE, isComponent = constant.FALSE

  if (dynamicTag) {
    isComponent = constant.TRUE
  }
  else {
    isSvg = svgTagNames[staticTag] !== constant.UNDEFINED

    // 是 svg 就不可能是组件
    // 加这个判断的原因是，svg 某些标签含有 连字符 和 大写字母，比较蛋疼
    if (!isSvg && componentNamePattern.test(staticTag)) {
      isComponent = constant.TRUE
    }
    else if (staticTag === 'style') {
      isStyle = constant.TRUE
    }
  }

  return creator.createElement(
    staticTag,
    dynamicTag,
    isSvg,
    isStyle,
    isComponent
  )
}

export function compatElement(element: Element) {

  let { tag, attrs } = element, hasType = constant.FALSE, hasValue = constant.FALSE

  if (attrs) {
    array.each(
      attrs,
      function (attr) {

        const name = attr.type === nodeType.ATTRIBUTE
          ? (attr as Attribute).name
          : constant.UNDEFINED

        if (name === 'type') {
          hasType = constant.TRUE
        }
        else if (name === 'value') {
          hasValue = constant.TRUE
        }

      }
    )
  }
  // 补全 style 标签的 type

  // style 如果没有 type 则加一个 type="text/css"
  // 因为低版本 IE 没这个属性，没法正常渲染样式
  if (element.isStyle && !hasType) {
    const attr = creator.createAttribute('type')
    attr.value = 'text/css'
    array.push(
      element.attrs || (element.attrs = []),
      attr
    )
  }
  // 低版本 IE 需要给 option 标签强制加 value
  else if (tag === 'option' && !hasValue) {
    element.isOption = constant.TRUE
  }

}

export function setElementText(element: Element, text: ExpressionNode | string) {
  if (is.string(text)) {
    if (htmlEntityPattern.test(text as string)) {
      element.html = text as string
    }
    else {
      element.text = text as string
    }
  }
  else {
    element.text = text as ExpressionNode
  }
  return constant.TRUE
}

export function setElementHtml(element: Element, expr: ExpressionNode) {
  element.html = expr
  return constant.TRUE
}
