import React from 'react'
import { NodeResizer } from 'reactflow'
import NodeTitle from '../NodeTitle.jsx'
import CustomHandle from '../CustomHandle.jsx'
import { useSizeSync } from './hooks.js'

/**
 * 节点外壳（所有节点的公共骨架基座）。
 *
 * 统一封装并根治「调整尺寸/改比例时端口错位」：
 *  1. 根 div 恒为 h-full（= wrapper 高度），端口 top:50% 即 wrapper 中点，
 *     与 React Flow 计算的 handle 位置（wrapper height/2）一致 → 永不错位。
 *  2. NodeResizer 拖拽时自动 updateNodeInternals，重算 handle。
 *  3. useSizeSync 在比例变化时同步 wrapper 高度（宽度÷比例），并 updateNodeInternals。
 *  4. 子内容（主显示框）建议用 flex-1 填满根 div 剩余高度，不要再用
 *     aspectRatio 双重约束高度，避免根 div 溢出导致端口偏移。
 *
 * @param props
 *  - id, label, defaultTitle, icon   标题栏
 *  - selected                         选中态（z-50）
 *  - resizable                        是否可拖拽调尺寸（默认 true）
 *  - minWidth, minHeight              NodeResizer 最小尺寸
 *  - keepAspect                       拖拽时是否保持比例
 *  - aspectRatio                      'Auto'|'16:9'|...（启用比例同步，返回解析后比例）
 *  - defaultHeight                    aspectRatio=Auto 时的默认高度
 *  - sizeMode                         'width-fixed'（默认，生图）| 'area-fixed'（特惠视频）
 *  - baseSize                         area-fixed 的面积基准（默认 380）
 *  - handleVariant                    'large'|'small'
 *  - className                        追加到根 div 的 class
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
  children
}) {
  // 比例同步：改比例时同步 wrapper 尺寸（返回解析后比例或 null）
  const ratio = useSizeSync(id, aspectRatio, {
    mode: sizeMode,
    defaultHeight,
    baseSize
  })
  const effectiveKeepAspect = keepAspect || !!ratio

  return (
    <div
      className={`relative flex flex-col items-center group/node w-full h-full min-w-[160px] min-h-[160px] ${selected ? 'z-50' : 'z-10'} ${className}`}
    >
      <NodeTitle id={id} label={label} defaultTitle={defaultTitle} icon={icon} />

      {/* 尺寸调整（复刻 _Component9：仅右下角白色圆角手柄，无环绕边框） */}
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

      {/* 端口统一渲染，相对根 div（h-full）定位 → 永在 wrapper 中点 */}
      <CustomHandle position="left" variant={handleVariant} />
      <CustomHandle position="right" variant={handleVariant} />
    </div>
  )
}
