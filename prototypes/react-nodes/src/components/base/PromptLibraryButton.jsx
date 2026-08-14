import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import PromptLibrary from './PromptLibrary.jsx'

/**
 * 预设提示词按钮（复刻各节点底部「预设」入口 → 打开提示词库弹窗）。
 *
 * 点「预设」→ 弹出 PromptLibrary 提示词库弹窗；
 * 点某条「使用」→ 在视口中央新建一个文本节点（内容 = 该预设的 prompt）。
 *
 * 落点规则统一为「视口中央」（与 App Q/W/E 快捷键、右键菜单一致）；
 * 输入面板默认收起（expanded:false，与 defaultNodeData 统一兜底一致）。
 * 不依赖 App 传参，遵循关注点分离、节点自包含。
 *
 * @param {object} props
 *  - category  当前节点类型对应的提示词分类（'image' | 'video' | 'text'，用于弹窗默认筛选）
 */
export default function PromptLibraryButton({ category = 'text' }) {
  const [open, setOpen] = useState(false)
  const { addNodes, screenToFlowPosition } = useReactFlow()

  // 点「使用」→ 新建文本节点（内容 = 预设 prompt）
  const handleUse = (prompt) => {
    // 落点：统一视口中央
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const newNode = {
      id: `textNode-${Date.now()}`,
      type: 'textNode',
      position,
      data: {
        label: '',
        text: prompt,
        prompt: '',
        selectedModel: 'gpt-4o-mini',
        expanded: false // 输入框默认收起
      }
    }
    addNodes([newNode])
  }

  return (
    <>
      <div className="w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" />
      <button
        className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
        title="预设提示词"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        <Sparkles size={10} className="text-blue-400" />
        <span>预设</span>
      </button>
      <PromptLibrary open={open} onClose={() => setOpen(false)} onUse={handleUse} defaultCategory={category} />
    </>
  )
}
