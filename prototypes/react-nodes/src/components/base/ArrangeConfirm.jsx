import React from 'react'

/**
 * 整理后「是否保留此次整理结果？」确认弹窗（复刻 H_.jsx:11993-12012）。
 *
 * 排列/自动布局写回新位置后弹出，提供：
 *  - 还原：把排列前的节点/边快照写回（撤销本次整理）+ fitView；
 *  - 保留：仅关闭弹窗，保留整理后的结果。
 *
 * @param {Object} props
 * @param {Object|null} props.snapshot  排列前快照 { nodes, edges }；null 时不渲染
 * @param {Function} props.onRevert     还原按钮回调（调用方写回快照 + fitView + 关闭）
 * @param {Function} props.onKeep       保留按钮回调（调用方关闭弹窗）
 */
export default function ArrangeConfirm({ snapshot, onRevert, onKeep }) {
  if (!snapshot) return null

  return (
    <div className="absolute bottom-full left-0 mb-4 bg-[#222] border border-[#333] rounded-xl shadow-2xl p-4 w-[240px] text-gray-300 animate-slide-up origin-bottom-left z-[1000] pointer-events-auto">
      <div className="text-sm font-medium mb-4 text-center">是否保留此次整理结果？</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRevert}
          className="flex-1 py-1.5 rounded-lg text-sm transition-colors text-gray-400 hover:text-white hover:bg-[#333] border border-[#444]"
        >
          还原
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[#333] text-white hover:bg-[#444] border border-[#555]"
        >
          保留
        </button>
      </div>
    </div>
  )
}
