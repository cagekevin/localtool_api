import React from 'react'

/**
 * 幽灵目标节点（复刻官方 ghostTarget）：不可见占位节点。
 * 从端口拖出到空白时，官方在鼠标位置放一个不可见节点 + 一条幽灵边，
 * 弹出「选择下游类型」菜单。选类型后把真实节点放到这里并替换幽灵边。
 * 本组件渲染空（style 控制为 1x1 透明）。
 */
export default function GhostTargetNode() {
  return null
}
