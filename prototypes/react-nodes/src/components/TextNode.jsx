import React, { useState, useRef } from 'react'
import {
  FileText, Plus, Copy, ChevronDown, ChevronUp, Loader2,
  Sparkles, AlertCircle, Link as LinkIcon
} from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'
import ExpandablePanel from './base/ExpandablePanel.jsx'
import GenerateButton from './base/GenerateButton.jsx'
import ModelSelect from './base/ModelSelect.jsx'
import PromptInput from './base/PromptInput.jsx'
import { useGenerate } from './base/hooks.js'

/**
 * 文本节点（复刻原 Co.jsx / textNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + ModelSelect + GenerateButton + PromptInput。
 * 保留差异化：文本编辑区（双击编辑）、自动拆分、预设菜单。
 */
export default function TextNode({ id, data, selected }) {
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [text, setText] = useState(data.text || '')
  const [autoSplit, setAutoSplit] = useState(data.autoSplit || false)
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  const [editingText, setEditingText] = useState(false)
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || 'gpt-4o-mini')
  const [images, setImages] = useState(data.images || [])
  const textAreaRef = useRef(null)
  const fileRef = useRef(null)

  // 生成模拟（useGenerate 基座 hook）
  const { loading, error, start: onGenerate, stop: onStop } = useGenerate({
    onDone: () => setText('这是一段由 AI 生成的文本内容，用于演示文本节点的输出效果。'),
    delay: 1800
  })

  const uploadImage = (e) => {
    const f = e.target.files?.[0]
    if (f) setImages((prev) => [...prev, URL.createObjectURL(f)])
    e.target.value = ''
  }

  const loadingIcon = <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'rgb(210,2,7)' }} />
  const models = [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini', badge: 'builtin' },
    { id: 'gpt-4o', label: 'gpt-4o', badge: 'builtin' },
    { id: 'deepseek-v3', label: 'deepseek-v3', badge: 'builtin' },
    { id: 'claude-3.5-sonnet', label: 'claude-3.5-sonnet', badge: 'builtin' }
  ]
  const refImages = images.map((u, i) => ({ id: `img-${i}`, url: u, label: `图片${i + 1}` }))
  const refTexts = [{ id: 'ref-t1', label: '参考文本', text: '参考文本' }]

  const toolbarButtons = [
    ...(images.length === 0
      ? [{ key: 'upload', icon: <Plus size={12} />, title: '上传图片', onClick: () => fileRef.current?.click() }]
      : []),
    { key: 'copy', icon: <Copy size={12} />, title: '复制文本', onClick: () => navigator.clipboard?.writeText(text) },
    { key: 'toggle', icon: expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />, title: expanded ? '收起输入' : '展开输入', onClick: () => setExpanded((v) => !v) }
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="文本生成"
      icon={<FileText size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      defaultHeight={240}
      className="transition-all"
    >
      {/* hover 操作栏 */}
      <HoverToolbar buttons={toolbarButtons} loading={loading} loadingIcon={loadingIcon} />

      {/* 隐藏文件上传（复刻 Co.jsx:250） */}
      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={uploadImage} />

      {/* 主容器：flex-1 填满 wrapper（wrapper 高度由 useSizeSync defaultHeight=240 同步），
          与生图/特惠视频节点一致，避免 wrapper≠主框导致端口/面板位置错位 */}
      <div
        className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-[border-color] duration-200 flex flex-col w-full flex-1 min-h-0 ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}
        onClick={(e) => {
          if (!editingText && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
            setExpanded((v) => !v)
          }
        }}
      >
        {/* 文本内容区 */}
        <div
          className={`flex-1 min-h-0 p-3 overflow-hidden bg-[#1a1a1a] relative rounded-xl ${editingText ? 'nopan nowheel nodrag' : 'drag-handle cursor-move'}`}
          onWheel={(e) => e.stopPropagation()}
          onDoubleClick={() => {
            if (!editingText) {
              setEditingText(true)
              setTimeout(() => textAreaRef.current?.focus(), 0)
            }
          }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]/70 z-10">
              <Loader2 size={20} className="animate-spin" style={{ color: 'rgb(210,2,7)' }} />
              <span className="ml-2 text-xs text-gray-400">生成中...</span>
            </div>
          )}
          {error ? (
            <div className="text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          ) : (
            <>
              {!text && !loading && !editingText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <FileText size={72} className="text-gray-700" strokeWidth={1.2} />
                  <span className="text-xs text-gray-600">双击编辑内容或AI生成</span>
                </div>
              )}
              <textarea
                ref={textAreaRef}
                className={`w-full h-full bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel resize-none ${editingText ? 'nodrag nopan' : 'pointer-events-none'}`}
                style={{ fontSize: '14px', color: '#a1a1aa' }}
                placeholder=""
                value={text}
                readOnly={!editingText}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => setEditingText(false)}
                onWheel={(e) => e.stopPropagation()}
              />
            </>
          )}
        </div>
      </div>

      {/* 展开的提示词面板（复刻 Co.jsx:666 过渡） */}
      <ExpandablePanel expanded={expanded} minWidth={420}>
        <div className="space-y-3">
          {/* 素材缩略图区 */}
          <div className="flex flex-wrap gap-2 mb-1">
            <div className="w-8 h-8 rounded overflow-hidden border border-blue-500/50 relative group bg-black" title="通过 @ 选中的素材">
              <img src="https://picsum.photos/seed/textnode/80/80" className="w-full h-full object-cover opacity-80" alt="素材" />
              <span className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all text-white text-[8px]">×</span>
            </div>
            <div className="h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text" title="参考文本">
              <LinkIcon size={10} />
              <span className="max-w-[60px] truncate">参考文本</span>
            </div>
          </div>

          {/* 提示词输入（基座 PromptInput） */}
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            placeholder="输入提示词 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={(name) => setPrompt((p) => (p ? `${p} @${name} ` : `@${name} `))}
          />

          {/* 底部：自动拆分 + 模型 + 预设 + 生成 */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer h-6 px-2 text-[11px] text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded transition-colors">
                <input type="checkbox" checked={autoSplit} onChange={(e) => setAutoSplit(e.target.checked)} className="accent-blue-500 rounded sm:w-3 sm:h-3" />
                自动拆分
              </label>

              {/* 模型选择（基座 ModelSelect） */}
              <ModelSelect value={selectedModel} onChange={setSelectedModel} models={models} />

              {/* 预设提示词 */}
              <div className="relative nodrag flex items-center">
                <div className="w-[1px] h-3 bg-[#444] mr-1.5" />
                <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowPresetMenu((v) => !v) }} title="预设提示词">
                  <Sparkles size={10} className="text-blue-400" />
                  <span>预设</span>
                </button>
                {showPresetMenu && (
                  <div className="absolute bottom-full left-0 mb-1 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 w-56 nowheel nopan nodrag" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] text-gray-500 px-1 pb-1">选择预设</div>
                    {['爆款标题', '小红书文案', '种草笔记'].map((p) => (
                      <div key={p} role="button" className="px-2 py-1.5 text-[11px] rounded-md text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200 cursor-pointer" onClick={() => { setPrompt((prev) => (prev ? `${prev}, ${p}` : p)); setShowPresetMenu(false) }}>{p}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 生成 / 停止（基座 GenerateButton） */}
            <GenerateButton loading={loading} onGenerate={onGenerate} onStop={onStop} showCost={false} />
          </div>
        </div>
      </ExpandablePanel>
    </NodeShell>
  )
}
