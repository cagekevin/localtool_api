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
import ResizeFullscreenHandle from './base/ResizeFullscreenHandle.jsx'
import FullscreenModal from './base/FullscreenModal.jsx'
import { useGenerate, useNodeResize, useOutsideClick } from './base/hooks.js'

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
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  const wrapperRef = useRef(null) // NodeShell 根 div ref（主框手柄拖拽改整体尺寸）
  const presetMenuRef = useRef(null) // 预设提示词菜单容器（点击外部关闭）
  // 预设菜单打开时点击外部自动关闭（公共 hook）
  useOutsideClick(presetMenuRef, showPresetMenu, () => setShowPresetMenu(false))
  // 全屏编辑状态（复刻 Co.jsx:33,35 的 m/y → 主框/输入框全屏）
  const [fullscreenText, setFullscreenText] = useState(false)
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)

  // 尺寸写回（基座 useNodeResize）：
  //  - onMainBoxResize：主框手柄 → node.width/height + updateNodeInternals（wrapper 跟随，端口不错位）
  //  - onInputResize：输入框手柄 → node.data.inputWidth/inputHeight（复刻官方）
  const { onMainBoxResize, onInputResize } = useNodeResize(id)

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
      wrapperRef={wrapperRef}
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

        {/* 右下角手柄：双击全屏编辑文本内容（复刻 Co.jsx:314 _Component23）。
            targetRef=NodeShell 根 div（wrapper），拖拽改其 DOM 实时预览，
            onResizeEnd 写回 ReactFlow node.width/height + updateNodeInternals，
            让 ReactFlow wrapper 跟随 → 端口基于 wrapper 中点不错位 */}
        <ResizeFullscreenHandle
          targetRef={wrapperRef}
          minWidth={320}
          minHeight={180}
          onRequestFullscreen={() => setFullscreenText(true)}
          onResizeEnd={onMainBoxResize}
        />
      </div>

      {/* 展开的提示词面板（复刻 Co.jsx:666 过渡）。
          手柄不在 ExpandablePanel 内统一渲染，由本节点在面板 children 里渲染，
          targetRef=textarea, onResizeEnd 写回 node.data.inputWidth/inputHeight。 */}
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
            ref={promptInputRef}
            value={prompt}
            onChange={setPrompt}
            placeholder="输入提示词 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={(name) => setPrompt((p) => (p ? `${p} @${name} ` : `@${name} `))}
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
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

              {/* 预设提示词（ref 绑在外层 relative，使「按钮 + 菜单」都在 ref 内，
                  点按钮不会误关，点外部才关） */}
              <div ref={presetMenuRef} className="relative nodrag flex items-center">
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

        {/* 面板右下角手柄：拖拽改输入框尺寸 + 双击全屏（复刻 Co.jsx:672 _Component23）。
            targetRef=textarea（promptInputRef），拖拽改 textarea 尺寸；
            onResizeEnd → onInputResize 写回 node.data.inputWidth/inputHeight，
            textarea 的 inline style 读这个 data 渲染（见 PromptInput）。
            注意：输入框是面板里的「部件」，不参与节点端口定位，所以只写 data，
            不走 onMainBoxResize 那种 node.width/height 写回。 */}
        <ResizeFullscreenHandle
          targetRef={promptInputRef}
          minWidth={200}
          maxWidth={900}
          minHeight={60}
          maxHeight={400}
          onRequestFullscreen={() => setFullscreenPrompt(true)}
          onResizeEnd={onInputResize}
        />
      </ExpandablePanel>

      {/* 全屏弹层（复刻 Ai.jsx）：主框全屏编辑文本内容 */}
      <FullscreenModal open={fullscreenText} title="编辑文本内容" onClose={() => setFullscreenText(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="输入文本内容..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </FullscreenModal>

      {/* 全屏弹层（复刻 Ai.jsx）：输入框全屏编辑提示词 */}
      <FullscreenModal open={fullscreenPrompt} title="编辑提示词 - 文本" onClose={() => setFullscreenPrompt(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="输入提示词..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </FullscreenModal>
    </NodeShell>
  )
}
