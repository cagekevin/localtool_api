import React from 'react'

/**
 * 展开面板基座（复刻各节点底部输入面板的公共结构）。
 *
 * 统一展开/收起过渡：
 *  展开  → opacity-100 scale-100 p-4 overflow-visible
 *  收起  → opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden
 * 始终渲染，用 class 控制过渡，而非条件渲染。
 *
 * @param props
 *  - expanded      是否展开
 *  - minWidth      面板最小宽度
 *  - children      面板内容（提示词输入 + 底部参数区等）
 *  - onClickStop   面板内部点击是否需要 stopPropagation（默认 true）
 */
export default function ExpandablePanel({
  expanded,
  minWidth = 500,
  children,
  onClickStop = true
}) {
  return (
    <div
      className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[${minWidth}px] w-max max-w-[920px] transition-all duration-300 origin-top z-40
        ${expanded ? 'opacity-100 scale-100 p-4 overflow-visible' : 'opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden'}
      `}
      onClick={onClickStop ? (e) => e.stopPropagation() : undefined}
    >
      {expanded && children}
    </div>
  )
}
