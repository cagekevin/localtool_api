import React, { useState, useEffect, useRef } from 'react'
import { Zap, Sparkles, Coins } from 'lucide-react'

/**
 * 模型选择下拉（复刻各节点「内置模型」选择）。
 *
 * @param props
 *  - value       当前选中模型
 *  - onChange    选中回调
 *  - models      模型数组 [{ id, label, badge, cost }]；badge: 'builtin'|'third'|'scheduled'
 *  - placeholder 未选时文案（默认「选择模型」）
 *  - costMap     模型→币消耗映射（可选，显示在选项右侧）
 */
export default function ModelSelect({
  value,
  onChange,
  models = [],
  placeholder = '选择模型',
  costMap = {}
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  const badge = (id) => {
    const item = models.find((m) => m.id === id)
    return item?.badge || 'builtin'
  }
  const badgeClass =
    badge(value) === 'scheduled'
      ? 'border-blue-400 text-blue-300'
      : badge(value) === 'third'
        ? 'border-gray-500 text-gray-300'
        : 'border-white/30 text-white/90'

  return (
    <div className="relative nodrag flex items-center" ref={ref}>
      <div className="w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" />
      <button
        type="button"
        className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        title={value ? `${value}（内置）` : '选择模型'}
      >
        <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 ${badgeClass}`}>
          {badge(value) === 'scheduled' ? '调度' : badge(value) === 'third' ? '三方' : '内置'}
        </span>
        <span className="whitespace-nowrap">{value || placeholder}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between">
            <span className="flex items-center gap-1"><Zap size={10} className="w-2.5 h-2.5" strokeWidth={2.5} />模型调度</span>
            <span className="ml-auto text-white/90 hover:text-white cursor-pointer transition-colors">配置 ›</span>
          </div>
          <div className="text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1">
            <Sparkles size={10} />内置模型
            <span className="ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap">详情 ›</span>
          </div>
          {models.map((m) => {
            const selected = value === m.id
            const itemBadge = m.badge || 'builtin'
            const itemBadgeClass =
              itemBadge === 'scheduled'
                ? 'border-blue-400 text-blue-300'
                : itemBadge === 'third'
                  ? 'border-gray-500 text-gray-300'
                  : 'border-white/30 text-white/90'
            const cost = costMap[m.id]
            return (
              <div
                key={m.id}
                role="button"
                className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${selected ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`}
                onClick={() => { onChange(m.id); setOpen(false) }}
              >
                <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 ${itemBadgeClass}`}>
                  {itemBadge === 'scheduled' ? '调度' : itemBadge === 'third' ? '三方' : '内置'}
                </span>
                <span className="flex-1 whitespace-nowrap">{m.label || m.id}</span>
                {cost != null && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums">
                    <Coins className="w-2.5 h-2.5" strokeWidth={2.5} />{cost}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
