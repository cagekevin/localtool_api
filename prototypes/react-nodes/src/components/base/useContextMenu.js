import { useState, useCallback, useRef } from 'react'
import { isEditableTarget } from './hooks.js'

/**
 * 右键菜单状态 hook（复刻 H_.jsx:131,1324-1388 的 Fe/Xe 菜单状态与三个触发 handler）。
 *
 * 提供：
 *  - state       { x, y, type, nodeId } | null
 *  - containerRef 画布容器 ref（供 ContextMenu 做坐标基准与防溢出）
 *  - onPaneContextMenu / onNodeContextMenu / onSelectionContextMenu / onSelectionEnd
 *    直接传给 ReactFlow 的四个回调
 *  - onPaneClick 点击空白关闭菜单
 *  - close      手动关闭
 *
 * 坐标均换算为相对画布容器的 x/y（复刻源码用 container.getBoundingClientRect() 作基准）。
 */
export function useContextMenu() {
  const [state, setState] = useState(null)
  const containerRef = useRef(null)

  const toContainerPos = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const open = useCallback(
    (type, nodeId, e) => {
      if (isEditableTarget(e)) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = toContainerPos(e.clientX, e.clientY)
      setState(nodeId ? { x, y, type, nodeId } : { x, y, type })
    },
    [toContainerPos]
  )

  // 空白处右键
  const onPaneContextMenu = useCallback((e) => open('canvas', null, e), [open])
  // 节点右键
  const onNodeContextMenu = useCallback((e, node) => open('node', node.id, e), [open])
  // 多选框右键
  const onSelectionContextMenu = useCallback((e, nodes) => open('selection', null, e), [open])
  // 拖拽框结束且选中>1 时弹出（复刻 er：延迟 50ms 判断选中数）
  const onSelectionEnd = useCallback(
    (e, nodes) => {
      setTimeout(() => {
        const n = nodes || []
        if (n.length > 1) open('selection', null, e)
      }, 50)
    },
    [open]
  )

  // 点击空白关闭（复刻 nr）
  const onPaneClick = useCallback(() => setState(null), [])

  const close = useCallback(() => setState(null), [])

  return {
    state,
    containerRef,
    onPaneContextMenu,
    onNodeContextMenu,
    onSelectionContextMenu,
    onSelectionEnd,
    onPaneClick,
    close
  }
}
