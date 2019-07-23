import {
  HINT_STRING,
  HINT_NUMBER,
  HINT_BOOLEAN,
} from 'yox-config/src/config'

import * as array from 'yox-common/src/util/array'
import * as string from 'yox-common/src/util/string'
import * as constant from 'yox-common/src/util/constant'

import Element from '../node/Element'
import Attribute from '../node/Attribute'
import Property from '../node/Property'

import * as helper from '../helper'
import * as creator from '../creator'
import * as nodeType from '../nodeType'

// 首字母大写，或中间包含 -
const componentNamePattern = /^[$A-Z]|-/,

// HTML 实体（中间最多 6 位，没见过更长的）
htmlEntityPattern = /&[#\w\d]{2,6};/,

// 常见的自闭合标签
selfClosingTagNames = 'area,base,embed,track,source,param,input,col,img,br,hr'.split(','),

// 常见的 svg 标签
svgTagNames = 'svg,g,defs,desc,metadata,symbol,use,image,path,rect,circle,line,ellipse,polyline,polygon,text,tspan,tref,textpath,marker,pattern,clippath,mask,filter,cursor,view,animate,font,font-face,glyph,missing-glyph,foreignObject'.split(','),

// 常见的字符串类型的属性
// 注意：autocomplete,autocapitalize 不是布尔类型
stringProperyNames = 'id,class,name,value,for,accesskey,title,style,src,type,href,target,alt,placeholder,preload,poster,wrap,accept,pattern,dir,autocomplete,autocapitalize'.split(','),

// 常见的数字类型的属性
numberProperyNames = 'min,minlength,max,maxlength,step,width,height,size,rows,cols,tabindex'.split(','),

// 常见的布尔类型的属性
booleanProperyNames = 'disabled,checked,required,multiple,readonly,autofocus,autoplay,controls,loop,muted,novalidate,draggable,hidden,spellcheck'.split(','),

// 某些属性 attribute name 和 property name 不同
attr2Prop = {}

// 列举几个常见的
attr2Prop['for'] = 'htmlFor'
attr2Prop['class'] = 'className'
attr2Prop['accesskey'] = 'accessKey'
attr2Prop['style'] = 'style.cssText'
attr2Prop['novalidate'] = 'noValidate'
attr2Prop['readonly'] = 'readOnly'
attr2Prop['tabindex'] = 'tabIndex'
attr2Prop['minlength'] = 'minLength'
attr2Prop['maxlength'] = 'maxLength'

export function isSelfClosing(tagName: string) {
  return array.has(selfClosingTagNames, tagName)
}

export function createAttribute(element: Element, name: string): Attribute | Property {

  // 组件用驼峰格式
  if (element.isComponent) {
    return creator.createAttribute(
      string.camelize(name)
    )
  }
  // 原生 dom 属性
  else {

    // 把 attr 优化成 prop
    const lowerName = string.lower(name)

    // <slot> 、<template> 或 svg 中的属性不用识别为 property
    if (helper.specialTags[element.tag] || element.isSvg) {
      return creator.createAttribute(name)
    }
    // 尝试识别成 property
    else if (array.has(stringProperyNames, lowerName)) {
      return creator.createProperty(
        attr2Prop[lowerName] || lowerName,
        HINT_STRING
      )
    }
    else if (array.has(numberProperyNames, lowerName)) {
      return creator.createProperty(
        attr2Prop[lowerName] || lowerName,
        HINT_NUMBER
      )
    }
    else if (array.has(booleanProperyNames, lowerName)) {
      return creator.createProperty(
        attr2Prop[lowerName] || lowerName,
        HINT_BOOLEAN
      )
    }

    // 没辙，还是个 attribute
    return creator.createAttribute(name)

  }
}

export function getAttributeDefaultValue(element: Element, name: string) {
  // 比如 <Dog isLive>
  if (element.isComponent) {
    return constant.TRUE
  }
  // <div data-name checked>
  else {
    return string.startsWith(name, 'data-')
      ? constant.EMPTY_STRING
      : name
  }
}

export function createElement(tagName: string) {

  let isSvg = array.has(svgTagNames, tagName), isComponent = constant.FALSE

  // 是 svg 就不可能是组件
  // 加这个判断的原因是，svg 某些标签含有 连字符 和 大写字母，比较蛋疼
  if (!isSvg && componentNamePattern.test(tagName)) {
    isComponent = constant.TRUE
  }

  return creator.createElement(
    tagName,
    isSvg,
    tagName === 'style',
    isComponent
  )
}

export function compatElement(element: Element) {

  let { tag, attrs } = element, hasType = constant.FALSE, hasValue = constant.FALSE

  if (attrs) {
    array.each(
      attrs,
      function (attr) {

        const name = attr.type === nodeType.PROPERTY
          ? (attr as Property).name
          : constant.UNDEFINED

        if (name === 'type') {
          hasType = constant.TRUE
        }
        else if (name === constant.RAW_VALUE) {
          hasValue = constant.TRUE
        }

      }
    )
  }
  // 补全 style 标签的 type

  // style 如果没有 type 则加一个 type="text/css"
  // 因为低版本 IE 没这个属性，没法正常渲染样式
  if (element.isStyle && !hasType) {
    array.push(
      element.attrs || (element.attrs = []),
      creator.createProperty('type', HINT_STRING, 'text/css')
    )
  }
  // 低版本 IE 需要给 option 标签强制加 value
  else if (tag === 'option' && !hasValue) {
    element.isOption = constant.TRUE
  }

}

export function setElementText(element: Element, text: string) {
  if (htmlEntityPattern.test(text)) {
    element.html = text
    return constant.TRUE
  }
}