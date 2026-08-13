import React, { useMemo } from 'react'
import { NodeResizer, useStore } from 'reactflow'
import NodeTitle from '../NodeTitle.jsx'
import CustomHandle from '../CustomHandle.jsx'
import { useSizeSync } from './hooks.js'

// ReactFlow store 选择器：取单个节点的当前 width/height
// （订阅该节点尺寸变化，触发重渲染以保持根 div inline 尺寸 = wrapper 尺寸。
//  SSR / 未初始化时 store 可能无 nodeLookup，需安全兜底）
function useNodeSize(id) {
  return useStore((s) => {
    const lookup = s?.nodeLookup
    if (!lookup || !id) return { width: undefined, height: undefined }
    const n = lookup.get(id)
    if (!n) return { width: undefined, height: undefined }
    const w = n.width ?? n.style?.width
    const h = n.height ?? n.style?.height
    return { width: w, height: h }
  })
}

/**
 * 节点外壳（所有节点的公共骨架基座）。
 *
 * 统一封装并根治「调整尺寸/改比例时端口错位」：
 *  1. 根 div 的 width/height 用 ReactFlow store 订阅的 inline style（= node.width/height），
 *     与 ReactFlow wrapper（react-flow__node）保持像素级一致。
 *  2. NodeResizer 拖拽时 ReactFlow 自动同步 wrapper 并 updateNodeInternals。
 *  3. 节点自定义手柄 (ResizeFullscreenHandle) 拖拽根 div 后，onResizeEnd 写回 setNodes
 *     → ReactFlow wrapper 跟随 → 端口基于 wrapper 中点不错位。
 *  4. useSizeSync 在比例变化时同步 wrapper 尺寸。
 *
 * @param props
 *  - id, label, defaultTitle, icon   标题栏
 *  - selected                         选中态（z-50）
 *  - resizable                        是否可拖拽调尺寸（默认 true）
 *  - minWidth, minHeight              NodeResizer 最小尺寸
 *  - keepAspect                       拖拽时是否保持比例
 *  - aspectRatio                      'Auto'|'16:9'|...（启用比例同步）
 *  - defaultHeight                    aspectRatio=Auto 时的默认高度
 *  - sizeMode                         'width-fixed'（默认，生图）| 'area-fixed'（特惠视频）
 *  - baseSize                         area-fixed 的面积基准（默认 380）
 *  - handleVariant                    'large'|'small'
 *  - className                        追加到根 div 的 class
 *  - wrapperRef                       暴露根 div ref（供右下角手柄拖拽改整体尺寸）
 *  - children                         节点内容（hover栏 + 主显示框 + 展开面板）
 */
export default function NodeShell({
  id,
  label,
  defaultTitle,
  icon,
  selected,
  resizable = true,
  minWidth = 160,
  minHeight = 160,
  keepAspect = false,
  aspectRatio,
  defaultHeight = 420,
  sizeMode = 'width-fixed',
  baseSize = 380,
  handleVariant = 'large',
  className = '',
  wrapperRef,
  children
}) {
  // 比例同步：改比例时同步 wrapper 尺寸
  const ratio = useSizeSync(id, aspectRatio, {
    mode: sizeMode,
    defaultHeight,
    baseSize
  })
  const effectiveKeepAspect = keepAspect || !!ratio

  // 订阅当前节点尺寸，用于根 div inline style
  const { width, height } = useNodeSize(id)
  // 尺寸来源：node data（初始渲染时可能还没 width/height，回退到默认值）
  //  - 宽度：width-fixed 用 420，area-fixed 用面积基准（baseSize）
  //  - 高度：用 defaultHeight
  const fallbackW = useMemo(() => (sizeMode === 'width-fixed' ? 420 : baseSize), [sizeMode, baseSize])
  const inlineW = width ?? fallbackW
  const inlineH = height ?? defaultHeight

  return (
    <div
      ref={wrapperRef}
      className={`relative flex flex-col items-center group/node min-w-[160px] min-h-[160px] ${selected ? 'z-50' : 'z-10'} ${className}`}
      style={{ width: typeof inlineW === 'number' ? `${inlineW}px` : inlineW, height: typeof inlineH === 'number' ? `${inlineH}px` : inlineH }}
    >
      <NodeTitle label={label} defaultTitle={defaultTitle} icon={icon} />

      {/* 尺寸调整（ReactFlow NodeResizer：仅右下角白色圆角手柄） */}
      {resizable && (
        <NodeResizer
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={effectiveKeepAspect}
          isVisible={selected}
          color="#ffffff80"
          lineClassName="opacity-0"
          handleClassName="!text-white/60 hover:!text-blue-400"
        />
      )}

      {children}

      {/* 端口统一渲染，相对根 div 定位 → 在 wrapper 中点 */}
      <CustomHandle position="left" variant={handleVariant} />
      <CustomHandle position="right" variant={handleVariant} />
    </div>
  )
}