import React, { useMemo } from 'react'
import { NodeResizer, useStore } from '@xyflow/react'
import NodeTitle from '../NodeTitle.jsx'
import CustomHandle from '../CustomHandle.jsx'
import { useSizeSync } from './hooks.js'

// ReactFlow store 选择器：订阅单个节点的当前 width/height。
// 目的：让根 div 的 inline width/height 永远等于 ReactFlow 的 node.width/height。
// 当 NodeResizer 拖拽 / 自定义手柄 onMainBoxResize 写回 setNodes 后，store 更新 →
// 本 hook 触发重渲染 → 根 div 尺寸跟随新值 → 与 ReactFlow wrapper 保持像素一致。
// （SSR / 未初始化时 store 可能无 nodeLookup，需安全兜底返回 undefined，外层回退到默认尺寸）
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
 * ── 关键设计：根 div 尺寸必须 = ReactFlow node 尺寸 ──
 * 端口（CustomHandle）和连线都基于「节点整体中点」计算，而 ReactFlow 节点的尺寸由
 * node.width/height（或 style）决定。因此根 div 不能简单用 `w-full h-full`（那是跟父级
 * 容器，不是跟 ReactFlow 节点尺寸），而必须用 useNodeSize 从 store 订阅 node.width/height，
 * 以 inline style 渲染。这样 NodeResizer / 自定义手柄 / 改比例（useSizeSync）任一途径
 * 改了 node 尺寸，根 div 都跟着变，端口永远在正确中点，杜绝「拖了但端口跑偏」。
 *
 * 尺寸来源总览（都汇聚到 node.width/height）：
 *  - NodeResizer（ReactFlow 内置）：拖拽节点边缘改尺寸，ReactFlow 自动同步 wrapper。
 *  - ResizeFullscreenHandle（自定义手柄）：onResizeEnd → useNodeResize.onMainBoxResize
 *    → 写回 node.width/height + updateNodeInternals。
 *  - useSizeSync：改比例时按比例重算 node 尺寸。
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
 *  - style                            追加到根 div 的 inline style（如 { minHeight: 640 }
 *                                      可让宽节点即使 store n.height 没生效也撑出最小高度）
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
  style: extraStyle = {},
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
      style={{ width: typeof inlineW === 'number' ? `${inlineW}px` : inlineW, minHeight: typeof inlineH === 'number' ? `${inlineH}px` : inlineH, ...extraStyle }}
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