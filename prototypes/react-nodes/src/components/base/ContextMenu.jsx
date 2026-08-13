import React from 'react'

/**
 * 通用右键菜单基座（复刻 H_.jsx:12229-12619 的 ContextMenu）。
 *
 * 纯渲染组件：由 useContextMenu hook 提供 state 与关闭回调。
 * 三种 type：'canvas'（空白处）/ 'node'（单选节点）/ 'selection'（多选）。
 *
 * 菜单项配置（通过 items 数组传入）：
 *  - { type:'divider' }                                   → 分隔线
 *  - { key, icon, label, shortcut, danger, disabled, onClick, submenu }
 *    submenu: 子菜单数组（悬停展开，同构，支持嵌套）
 *
 * @param props
 *  - state        { x, y, type, nodeId } | null
 *  - items        (state) => items[]    根据 type 返回菜单项
 *  - onClose      关闭回调
 *  - containerRef 画布容器 ref（用于防溢出）
 */
export default function ContextMenu({ state, items, onClose, containerRef }) {
  if (!state) return null

  const style = computePosition(state, containerRef)
  const menuItems = typeof items === 'function' ? items(state) : items

  return (
    <div
      className="absolute z-50 bg-[#1c1c1e] border border-white/[0.04] rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.85)] p-2 flex flex-col min-w-[208px]"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {renderItems(menuItems, onClose)}
    </div>
  )
}

// 防溢出定位（复刻 H_.jsx Ji()：node/selection 预留 150px 高，canvas 预留 550px 高）
function computePosition({ x, y, type }, containerRef) {
  const nodeLike = type === 'node' || type === 'selection'
  const minH = nodeLike ? 150 : 550
  const minW = 160
  const rect = containerRef?.current?.getBoundingClientRect()
  if (rect) {
    if (x + minW > rect.width) x = rect.width - minW - 10
    if (y + minH > rect.height) y = Math.max(10, rect.height - minH - 10)
  }
  return { top: y, left: x }
}

// 统一渲染 icon：支持「组件引用（函数 / forwardRef 对象）」或「React 元素」两种形式
function renderIcon(icon, size = 16, className = '') {
  if (!icon) return null
  // 已是 React 元素（有 $$typeof）→ 直接渲染
  if (React.isValidElement(icon)) return icon
  // 否则视为组件引用（函数 或 forwardRef 对象），实例化。
  // 注意：forwardRef 组件 typeof 是 'object' 不是 'function'，必须用 React.createElement(icon) 统一处理。
  return React.createElement(icon, { size, className })
}

// 渲染菜单项（支持 divider / submenu）
function renderItems(items, onClose) {
  return (items || []).map((item, index) => {
    if (item.type === 'divider') {
      // key 用索引保证稳定（divider 没有业务 key）
      return <div key={`div-${index}`} className="h-[1px] bg-white/[0.04] my-2 mx-1" />
    }
    if (item.submenu && item.submenu.length) {
      return (
        <div key={item.key} className="relative group/sub">
          <button
            className={`w-full text-left px-3.5 py-2 text-[11px] text-gray-400 hover:text-gray-200 rounded-xl flex items-center gap-2 justify-between transition-colors`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              {renderIcon(item.icon, 13)}
              <span>{item.label}</span>
            </span>
            <span className="text-xl text-gray-400 leading-none">›</span>
          </button>
          <div
            className={`absolute left-full top-0 ml-2 bg-[#1c1c1e] border border-white/[0.04] rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.85)] p-2 min-w-[200px] z-50 hidden group-hover/sub:block before:content-[''] before:absolute before:-left-3 before:top-0 before:w-3 before:h-full`}
          >
            {renderItems(item.submenu, onClose)}
          </div>
        </div>
      )
    }
    // 分组子菜单（item.items）：渲染为带标题的小工具面板（复刻 H_.jsx:12301-12340 的 vi/_i）
    if (item.items && item.items.length) {
      return (
        <div key={item.key} className="relative group/tools">
          <button
            className="w-full text-left px-3.5 py-2 text-[11px] text-gray-400 hover:text-gray-200 rounded-xl flex items-center gap-2 justify-between transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              <span>{item.label}</span>
            </span>
            <span className="text-xl text-gray-400 leading-none">›</span>
          </button>
          <div
            className={`absolute left-full top-0 ml-2 bg-[#1c1c1e] border border-white/[0.04] rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.85)] p-2 w-[300px] z-50 hidden group-hover/tools:block before:content-[''] before:absolute before:-left-3 before:top-0 before:w-3 before:h-full`}
          >
            <div className="grid grid-cols-2 gap-0.5">
              {item.items.map((child) => (
                <button
                  key={child.key}
                  className="flex items-center rounded-lg hover:bg-white/10 transition-colors px-2.5 py-1.5 text-[13px] text-gray-200 hover:text-white text-left gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    child.onClick?.(e)
                    if (child.closeOnClick !== false) onClose()
                  }}
                >
                  {renderIcon(child.icon, 15, 'text-white shrink-0')}
                  <span className="truncate">{child.label}</span>
                  {child.badge && (
                    <span className={`rounded px-1 py-0.5 text-[8px] font-semibold ${child.badge.tone === 'new' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-fuchsia-500/20 text-fuchsia-300'}`}>
                      {child.badge.text}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
      <button
        key={item.key}
        disabled={item.disabled}
        onClick={(e) => {
          e.stopPropagation()
          item.onClick?.(e)
          if (item.closeOnClick !== false) onClose()
        }}
        className={`w-full text-left px-3.5 py-2 text-sm rounded-xl flex items-center gap-2.5 justify-between transition-colors ${
          item.danger
            ? 'text-red-400 hover:bg-[#333]'
            : 'text-gray-200 hover:bg-white/10 hover:text-white'
        } ${item.disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {renderIcon(item.icon, 16)}
          <span className="truncate">{item.label}</span>
        </span>
        {item.shortcut && <span className="text-[11px] text-gray-500 ml-3 font-mono shrink-0">{item.shortcut}</span>}
      </button>
    )
  })
}
