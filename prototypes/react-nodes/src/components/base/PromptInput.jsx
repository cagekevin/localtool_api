import React, { useState, useRef, useEffect } from 'react'
import { X, Link as LinkIcon } from 'lucide-react'

/**
 * 提示词输入区（复刻各节点 contentEditable 提示词 + @素材弹层）。
 *
 * 注意：用 textarea 模拟，支持输入 @ 触发素材引用弹层（演示按钮触发）。
 *
 * @param props
 *  - value      提示词
 *  - onChange   提示词变化
 *  - placeholder
 *  - refImages  参考图片素材 [{ id, url, label }]
 *  - refTexts   参考文本素材 [{ id, label, text }]
 *  - onInsert   插入素材引用（回调：name => void）
 */
export default function PromptInput({
  value,
  onChange,
  placeholder = '',
  refImages = [],
  refTexts = [],
  onInsert
}) {
  const [showMention, setShowMention] = useState(false)
  const inputRef = useRef(null)
  const mentionRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target)) setShowMention(false)
    }
    if (showMention) document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [showMention])

  const all = [
    ...refImages.map((i, idx) => ({ ...i, name: `图片${idx + 1}` })),
    ...refTexts.map((t, idx) => ({ ...t, name: `文本${idx + 1}` }))
  ]

  const insert = (name) => {
    onInsert?.(name)
    setShowMention(false)
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 nodrag relative shrink-0" style={{ minHeight: '80px', height: '80px' }}>
        <textarea
          ref={inputRef}
          className="w-full h-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan resize-none"
          style={{ minHeight: '80px', height: '80px', overflow: 'auto', lineHeight: 1.625 }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onWheel={(e) => e.stopPropagation()}
        />

        {showMention && (
          <div
            ref={mentionRef}
            className="absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]">
              <span className="text-xs text-gray-300 font-bold flex items-center gap-2">选择素材引用</span>
              <button className="text-gray-500 hover:text-white p-1" onClick={() => setShowMention(false)}>
                <X size={12} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag">
              {all.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                  <span className="text-[11px]">暂无素材</span>
                  <span className="text-[10px]">上传图片或连接其他节点后可用 @ 引用</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {all.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col"
                      onClick={() => insert(item.name)}
                    >
                      {item.url ? (
                        <img src={item.url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-[#222] flex flex-col items-center justify-center p-1 text-center">
                          <LinkIcon size={16} className="text-blue-400 opacity-80 mb-1" />
                          <span className="text-[8px] text-gray-400 truncate w-full">{item.label}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[10px] text-white">选择</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
