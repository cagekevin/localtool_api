import React, { useMemo } from 'react'
import { Play, LayoutGrid, Map, Maximize, Minus, Plus, RefreshCw, Zap } from 'lucide-react'

/**
 * 左下角工具栏（复刻 H_.jsx:12013-12094 bottom-left 工具栏）。
 *
 * 原工具栏按钮（含 title 悬浮说明）：
 *  - 运行整个工作流（Play，绿）
 *  - 整理画布（Scissors，Ctrl+L 自动布局）
 *  - 画布小地图（Map，点击开关 MiniMap）
 *  - 清理缓存（Trash2）
 *  - 适合视图（Maximize，fitView）
 *  - 缩放性能模式（Gauge，可选）
 *  - zoom out / zoom % / zoom in
 *
 * 样式令牌遵循 docs/39：容器 bg-[#222] border-[#333] rounded-full；按钮
 * hover:bg-[#333] hover:text-white；图标默认 text-gray-400；激活项 text-white。
 *
 * @param {Object} props
 * @param {boolean} props.minimapOn      小地图开关
 * @param {Function} props.onToggleMinimap
 * @param {Function} props.onArrange      整理画布
 * @param {Function} props.onFitView      适合视图
 * @param {Function} props.onZoomIn       放大
 * @param {Function} props.onZoomOut      缩小
 * @param {number} props.zoomPercent      当前缩放百分比（整型）
 * @param {boolean} props.performanceMode 缩放性能模式开关（激活黄色高亮）
 * @param {Function} props.onTogglePerformance
 * @param {Function} [props.onClearCache] 清理缓存（原型暂为占位）
 * @param {Function} [props.onRun]        运行整个工作流（原型暂为占位）
 */
export default function CanvasToolbar({
  minimapOn,
  onToggleMinimap,
  onArrange,
  onFitView,
  onZoomIn,
  onZoomOut,
  zoomPercent,
  performanceMode,
  onTogglePerformance,
  onClearCache,
  onRun,
}) {
  // 缩放%按钮可点击回到 100%
  const zoomPercentText = useMemo(() => `${zoomPercent}%`, [zoomPercent])

  const baseBtn =
    'p-2 rounded-full transition-colors flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#333]'
  const divider = <span className="w-[1px] h-4 bg-[#444] mx-2" />

  return (
    <div className="flex items-center gap-3">
      {/* 主工具组 */}
      <div className="flex items-center bg-[#222] border border-[#333] rounded-full px-2 py-1 shadow-xl">
        <button
          type="button"
          onClick={onRun}
          className={`${baseBtn} text-green-400`}
          title="运行整个工作流（从所有起点依次执行）"
        >
          <Play size={16} />
        </button>
        {divider}
        <button type="button" onClick={onArrange} className={baseBtn} title="整理画布">
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleMinimap}
          className={`${baseBtn} ${minimapOn ? 'text-white' : ''}`}
          title="画布小地图"
        >
          <Map size={16} />
        </button>
        <button
          type="button"
          onClick={onClearCache}
          className={baseBtn}
          title="清理缓存：将内联大资源转为本地URL"
        >
          <RefreshCw size={16} />
        </button>
        <button type="button" onClick={onFitView} className={baseBtn} title="适合视图">
          <Maximize size={16} />
        </button>
        {/* 缩放性能模式（复刻 H_.jsx:12047-12049，闪电图标 Zap，激活黄高亮） */}
        <button
          type="button"
          onClick={onTogglePerformance}
          className={`${baseBtn} ${performanceMode ? 'text-yellow-400 hover:text-yellow-300' : ''}`}
          title={performanceMode ? '缩放性能模式已开启' : '缩放性能模式已关闭'}
        >
          <Zap size={16} />
        </button>
        {divider}
        <button type="button" onClick={onZoomOut} className={`p-1.5 rounded-full transition-colors text-gray-400 hover:text-white hover:bg-[#333]`}>
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={onFitView}
          className="text-xs text-white font-medium min-w-[36px] text-center cursor-default select-none"
          title="点击适配视图"
        >
          {zoomPercentText}
        </button>
        <button type="button" onClick={onZoomIn} className={`p-1.5 rounded-full transition-colors text-gray-400 hover:text-white hover:bg-[#333]`}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
