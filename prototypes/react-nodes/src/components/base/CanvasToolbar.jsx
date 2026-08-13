import React, { useMemo } from 'react'
import { Play, LayoutGrid, Map, Maximize, Minus, Plus, RefreshCw, Zap } from 'lucide-react'

/**
 * 左下角工具栏（复刻 H_.jsx:12013-12094 bottom-left 工具栏）。
 *
 * 【抉择：为什么是「纯展示 + 回调上抛」】
 * 本组件**不含任何业务逻辑**，只渲染按钮、把点击通过 props 回调上抛给画布宿主（App.jsx）。
 * 原因（原则 1 关注点分离）：按钮「点一下该干嘛」是画布壳的决策（整理→dagre、小地图→切
 * MiniMap、缩放→fitView/zoomIn），不该埋在工具栏组件里。这样工具栏可被任何宿主复用，
 * 换一个画布（脚本盒、别的编辑器）直接换回调即可。
 *
 * 【抉择：图标取舍】
 * 官方图标是混淆后的 lucide 组件（Et/He/_Component124 等，无法直接引用）。本组件用
 * **语义等价**的 lucide 图标：
 *  - 整理画布 → LayoutGrid（网格布局，贴合 dagre 自动排列）
 *  - 清理缓存 → RefreshCw（缓存重整语义，非垃圾桶）
 *  - 性能模式 → Zap（闪电，激活黄高亮）
 * 视觉与官方「表达同一动作」即可，不追求逐像素一致（用户确认过不必 100%）。
 *
 * 【占位按钮说明（抉择）】
 * onRun（运行工作流）、onClearCache（清理缓存）当前是**占位**（props 可选、App 暂不传
 * 实际逻辑）。原型未接后端，故这两颗按钮点了暂无动作。接真系统时在 App.jsx 里传对应
 * 处理函数即可：
 *  - onRun        → 按连线拓扑从所有起点依次触发节点生成（官方 ti() 工作流执行）
 *  - onClearCache → 把节点 data 里的内联大资源转成 /files/ 本地 URL（官方 Ki 清理）
 *
 * @param {Object} props
 * @param {boolean} props.minimapOn      小地图开关（激活白高亮）
 * @param {Function} props.onToggleMinimap
 * @param {Function} props.onArrange      整理画布（dagre 自动排版）
 * @param {Function} props.onFitView      适合视图（fitView）
 * @param {Function} props.onZoomIn       放大
 * @param {Function} props.onZoomOut      缩小
 * @param {number} props.zoomPercent      当前缩放百分比（整型）
 * @param {boolean} props.performanceMode 缩放性能模式开关（激活黄高亮）
 * @param {Function} props.onTogglePerformance
 * @param {Function} [props.onClearCache] 清理缓存（原型暂为占位，接真系统再传）
 * @param {Function} [props.onRun]        运行整个工作流（原型暂为占位，接真系统再传）
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
