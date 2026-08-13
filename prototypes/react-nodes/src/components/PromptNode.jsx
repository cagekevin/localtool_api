import React, { useState, useRef } from 'react'
import {
  Image as ImageIcon, Plus, ZoomIn, Crop, Pencil, Send, Download, Link as LinkIcon,
  Loader2, AlertCircle, X, Sparkles, Coins, Zap
} from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'
import ExpandablePanel from './base/ExpandablePanel.jsx'
import GenerateButton from './base/GenerateButton.jsx'
import ModelSelect from './base/ModelSelect.jsx'
import PromptInput from './base/PromptInput.jsx'
import ResizeFullscreenHandle from './base/ResizeFullscreenHandle.jsx'
import JianyingIcon from './JianyingIcon.jsx'
import { useGenerate, useNodeResize, useOutsideClick } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'

/**
 * 生图节点（复刻原 bo.jsx / promptNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + PromptInput + GenerateButton + ModelSelect。
 * 保留差异化：主图片框、素材缩略图区、画质/比例/渲染质量菜单、请求格式、批量 xN。
 * 性能降级用通用 useMediaDegrade：lodLevel>=2 藏生图结果（与官方横幅"图片已隐藏"一致）。
 */
export default function PromptNode({ id, data, selected }) {
  // 性能模式媒体降级（通用 hook）：hideResult = isHidden('image')，即 lodLevel>=2
  const { isHidden } = useMediaDegrade()
  const hideResult = isHidden('image')

  // 通用连线数据传递：读取直接上游节点的产出（图片/文本）作为参考输入
  const connected = useConnectedInputs(id)
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || 'Auto')
  const [imageSize, setImageSize] = useState(data.imageSize || '1K')
  const [quality, setQuality] = useState(data.quality || 'auto')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || '')
  const [apiFormat, setApiFormat] = useState(data.apiFormat || 'auto')
  const [count, setCount] = useState(data.count || 1)
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '')
  const [showImgMenu, setShowImgMenu] = useState(false)
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const [showCountMenu, setShowCountMenu] = useState(false)
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  // 三个下拉菜单容器（画质/格式/数量）：ref 绑外层 relative，使「按钮+菜单」都在内，点外部才关
  const imgMenuRef = useRef(null)
  const formatMenuRef = useRef(null)
  const countMenuRef = useRef(null)
  useOutsideClick(imgMenuRef, showImgMenu, () => setShowImgMenu(false))
  useOutsideClick(formatMenuRef, showFormatMenu, () => setShowFormatMenu(false))
  useOutsideClick(countMenuRef, showCountMenu, () => setShowCountMenu(false))

  // 输入框尺寸写回 node.data（基座 useNodeResize，复刻官方 inputWidth/inputHeight）
  const { onInputResize } = useNodeResize(id)

  // 生成模拟（useGenerate 基座 hook）
  const { loading, error, start: onGenerate, stop: onStop } = useGenerate({
    onDone: () => setImageUrl(`https://picsum.photos/seed/promptgen-${Date.now()}/512/512`),
    delay: 2200
  })

  // 图片可选比例（去掉 1:3 / 3:1 / 2:1 / 1:2 等极端竖/横比例，保留常用档）
  const ratioOptions = ['Auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21']
  const sizeOptions = ['1K', '2K', '4K']
  const qualityOptions = [
    { value: 'auto', label: '自动' },
    { value: 'low', label: '低质量' },
    { value: 'medium', label: '中质量' },
    { value: 'high', label: '高质量' }
  ]
  const models = [
    { id: 'gpt-image-1', label: 'gpt-image-1', badge: 'builtin' },
    { id: 'dall-e-3', label: 'dall-e-3', badge: 'builtin' },
    { id: 'stable-diffusion-xl', label: 'stable-diffusion-xl', badge: 'builtin' },
    { id: 'flux-1.1-pro', label: 'flux-1.1-pro', badge: 'builtin' }
  ]
  const formatOptions = [
    { label: '自动检测', value: 'auto' },
    { label: 'OpenAI 格式', value: 'openai' },
    { label: 'Gemini 格式', value: 'gemini' }
  ]
  const costMap = { 'dall-e-3': 4 }

  // 参考输入 = 连线上游的产出（useConnectedInputs）+ 自身 data.images/texts。
  // 为什么合并两处：useConnectedInputs 是「通用连线机制」（任意上游节点 → 本节点）；
  // data.images 是剧本盒子连下游时用 collectAssets 按 @资产名 匹配后塞给本节点的资产参考图（更精准）。
  // 上游为空 + data 无图 → 两者都空 → 素材区隐藏，绝不显示假示例。
  const refImages = [...(connected.images || []), ...(data.images?.length ? data.images : [])]
  const refTexts = [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])]

  const insertMention = (name) => setPrompt((p) => (p ? `${p} @${name} ` : `@${name} `))
  const hasImage = !!imageUrl

  // hover 操作栏按钮
  const toolbarButtons = [
    ...(refImages.length === 0
      ? [{ key: 'upload', icon: <Plus size={14} />, title: '上传参考图', onClick: () => fileRef.current?.click() }]
      : []),
    ...(hasImage
      ? [
          { key: 'zoom', icon: <ZoomIn size={14} />, title: '放大' },
          { key: 'crop', icon: <Crop size={14} />, title: '裁剪' },
          { key: 'edit', icon: <Pencil size={14} />, title: '编辑' },
          { key: 'send', icon: <Send size={14} />, title: '发送到左侧网站', hoverClass: 'hover:text-blue-400' },
          { key: 'jianying', icon: <JianyingIcon size={14} />, title: '发送到剪映素材库', hoverClass: 'hover:text-emerald-400' },
          { key: 'download', icon: <Download size={14} />, title: '下载' }
        ]
      : [])
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="生图节点"
      icon={<ImageIcon size={11} className="text-gray-500" />}
      selected={selected}
      minWidth={160}
      minHeight={160}
      aspectRatio={aspectRatio}
      defaultHeight={420}
    >
      {/* hover 操作栏（loading 时隐藏） */}
      {!loading && <HoverToolbar buttons={toolbarButtons} />}

      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" />

      {/* 主图片框：点击切换展开/收起；flex-1 填满 wrapper（高度由 useSizeSync 同步）。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
      <div
        className="relative cursor-pointer group/image w-full flex flex-col flex-1 min-h-0"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${hasImage ? '' : 'bg-[#0d0c0c]'}`}>
          {/* 性能模式媒体降级：缩小时隐藏生图结果（复刻官方"图片已隐藏"） */}
          {hasImage && !loading && !error && hideResult && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-[#151515]">
              <ImageIcon size={24} className="text-gray-700" />
              <span className="text-[10px] text-gray-500">性能模式已隐藏</span>
            </div>
          )}
          {hasImage && !hideResult && (
            <img
              src={imageUrl}
              alt="Generated Content"
              loading="lazy"
              decoding="async"
              className={`max-w-full w-full h-full object-contain block rounded-lg ${loading ? 'opacity-50 blur-sm' : ''}`}
              draggable={false}
            />
          )}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0c0c]/70 z-10">
              <Loader2 size={28} className="animate-spin" style={{ color: 'rgb(210,2,7)' }} />
              <span className="text-xs text-gray-300 flex items-center gap-2">
                <Sparkles size={12} className="text-yellow-300" /> 生图中...
              </span>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-xs font-medium max-w-full break-words">{error}</span>
              <span className="text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors">请检查设置或重试</span>
            </div>
          )}
          {!hasImage && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none">
              <ImageIcon size={80} className="text-gray-700" strokeWidth={1.2} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none" />
        </div>
      </div>

      {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。 */}
      <ExpandablePanel expanded={expanded} minWidth={500}>
        <div className="space-y-3">
          {/* 素材缩略图区 */}
          {(refImages.length > 0 || refTexts.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-1">
              {refImages.map((img, i) => {
                const name = `图片${i + 1}`
                return (
                  <div key={img.id} className="w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan" title={img.isConnected ? '已连线的图片' : '上传的图片'}>
                    <img src={img.url} className="w-full h-full object-cover opacity-80 pointer-events-none" alt={name} />
                    <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                    <button type="button" className="absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors" title={`点击插入 @${name}`} onClick={(e) => { e.stopPropagation(); insertMention(name) }}>{name}</button>
                    <span className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all"><X size={10} className="text-white" /></span>
                  </div>
                )
              })}
              {refTexts.map((t, i) => {
                const name = `文本${i + 1}`
                return (
                  <div key={t.id} className="h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative" title={t.text} onClick={(e) => { e.stopPropagation(); insertMention(name) }}>
                    <LinkIcon size={10} />
                    <span className="max-w-[80px] truncate">{name} ({t.label})</span>
                    <span className="absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all"><X size={10} className="text-white" /></span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 提示词输入（基座 PromptInput，含 @素材弹层） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPrompt}
            placeholder="描述你想要的画面 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={insertMention}
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部参数区 */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a] nodrag">
            <div className="flex items-center gap-1.5 overflow-visible">
              {/* 画质 / 比例 / 渲染质量 */}
              <div ref={imgMenuRef} className="relative nodrag">
                <button type="button" className="flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowImgMenu((v) => !v) }}>
                  <span className="w-2.5 h-3 border border-current rounded-[2px]" />
                  <span>{aspectRatio} · {imageSize} · {qualityOptions.find((q) => q.value === quality)?.label}</span>
                </button>
                {showImgMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2">画质</div>
                      <div className="flex gap-1.5">{sizeOptions.map((s) => <button key={s} type="button" className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${imageSize === s ? 'bg-[#333] border-[#555] text-white' : 'bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]'}`} onClick={() => setImageSize(s)}>{s}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2">比例</div>
                      <div className="flex flex-wrap gap-1.5">{ratioOptions.map((r) => <button key={r} type="button" className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${aspectRatio === r ? 'bg-[#333] border-[#555] text-white' : 'bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]'}`} onClick={() => setAspectRatio(r)}>{r}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2">渲染质量</div>
                      <div className="flex gap-1.5">{qualityOptions.map((q) => <button key={q.value} type="button" className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${quality === q.value ? 'bg-[#333] border-[#555] text-white' : 'bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]'}`} onClick={() => setQuality(q.value)}>{q.label}</button>)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模型选择（基座 ModelSelect） */}
              <ModelSelect value={selectedModel} onChange={setSelectedModel} models={models} costMap={costMap} placeholder="选择模型" />

              {/* 请求格式 */}
              <div ref={formatMenuRef} className="relative nodrag flex items-center">
                <div className="w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" />
                <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowFormatMenu((v) => !v) }} title="请求格式">
                  <span className="truncate">{formatOptions.find((f) => f.value === apiFormat)?.label}</span>
                </button>
                {showFormatMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] text-gray-500 mb-2 px-1">请求格式</div>
                    {formatOptions.map((f) => <button key={f.value} className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${apiFormat === f.value ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`} onClick={() => { setApiFormat(f.value); setShowFormatMenu(false) }}>{f.label}</button>)}
                  </div>
                )}
              </div>

              {/* 预设 */}
              <div className="relative nodrag flex items-center">
                <div className="w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" />
                <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer" title="预设提示词">
                  <Sparkles size={10} className="text-blue-400" />
                  <span>预设</span>
                </button>
              </div>
            </div>

            {/* 批量 xN + 生成/停止 */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {!loading && (
                <div ref={countMenuRef} className="relative nodrag flex items-center">
                  <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded text-[11px] text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowCountMenu((v) => !v) }} title="批量生成数量">
                    <span>x{count}</span>
                  </button>
                  {showCountMenu && (
                    <div className="absolute bottom-full right-0 mb-1 w-16 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} className={`w-full text-center py-1.5 text-[11px] rounded-md transition-colors ${count === n ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`} onClick={(e) => { e.stopPropagation(); setCount(n); setShowCountMenu(false) }}>x{n}</button>)}
                    </div>
                  )}
                </div>
              )}
              <GenerateButton loading={loading} onGenerate={onGenerate} onStop={onStop} cost={count * 2} />
            </div>
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸（复刻 bo.jsx:1676 _Component23）。
            targetRef=textarea（promptInputRef），onResizeEnd → onInputResize 写回
            node.data.inputWidth/inputHeight，PromptInput 的 textarea 读这个 data 渲染。
            输入框是面板里的部件，不参与端口定位，所以只写 data，不改 node.width/height。 */}
        <ResizeFullscreenHandle
          targetRef={promptInputRef}
          minWidth={200}
          maxWidth={900}
          minHeight={60}
          maxHeight={400}
          onResizeEnd={onInputResize}
        />
      </ExpandablePanel>
    </NodeShell>
  )
}
