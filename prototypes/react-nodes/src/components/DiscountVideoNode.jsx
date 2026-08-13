import React, { useState, useRef } from 'react'
import {
  Clapperboard, Plus, Expand, Download, Trash2, Loader2, Play,
  AlertCircle, Settings, Sparkles, Link as LinkIcon, RefreshCw, Coins
} from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'
import ExpandablePanel from './base/ExpandablePanel.jsx'
import GenerateButton from './base/GenerateButton.jsx'
import ModelSelect from './base/ModelSelect.jsx'
import ResizeFullscreenHandle from './base/ResizeFullscreenHandle.jsx'
import JianyingIcon from './JianyingIcon.jsx'
import { useGenerate, useNodeResize, useOutsideClick } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useLod } from './base/useLod.js'

/**
 * 特惠视频节点（复刻原 As.jsx / discountVideoNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + GenerateButton + ModelSelect。
 * 保留差异化：主显示区、比例/分辨率/时长菜单、素材区、提示词输入。
 */
export default function DiscountVideoNode({ id, data, selected }) {
  // 性能模式 LOD 媒体降级（复刻官方横幅"图片视频已隐藏"）：
  //   lodLevel>=3（缩到 ≤0.2）隐藏视频。阈值比图片更晚（≥3）——视频隐藏代价更高，
  //   官方也是「lodLevel=3 才连视频一起藏」（横幅 yt===3 才写"图片视频已隐藏"）。
  // 接真系统：官方 As.jsx 用 useThumbnail 换视频首帧图（_frame1.jpg）。接资源缩略图服务后，
  //       把占位换成 <img src={poster/首帧}> 即可，hideVideo 判断保留。
  const { lodLevel = 0 } = useLod()
  const hideVideo = lodLevel >= 3

  // 通用连线数据传递：读取直接上游节点的图片/文本作为参考素材
  const connected = useConnectedInputs(id)
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [ratio, setRatio] = useState(data.size || '16:9')
  const [resolution, setResolution] = useState(data.resolution || '1080p')
  const [seconds, setSeconds] = useState(data.selectedSeconds || '10')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || 'runway-gen3')
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  const [videoUrl, setVideoUrl] = useState(data.videoUrl || '')
  const [showRatioMenu, setShowRatioMenu] = useState(false)
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  const ratioMenuRef = useRef(null) // 比例/分辨率/时长菜单容器（点击外部关闭）
  useOutsideClick(ratioMenuRef, showRatioMenu, () => setShowRatioMenu(false))

  // 输入框尺寸写回 node.data（基座 useNodeResize，复刻官方 inputWidth/inputHeight）
  const { onInputResize } = useNodeResize(id)

  const ratioOptions = [
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' }
  ]
  const resOptions = ['480p', '720p', '1080p']
  const durationOptions = ['4', '6', '8', '10', '12', '15']
  const models = [
    { id: 'runway-gen3', label: 'runway-gen3', badge: 'builtin' },
    { id: 'kling-1.5', label: 'kling-1.5', badge: 'builtin' },
    { id: 'pika-2.0', label: 'pika-2.0', badge: 'builtin' },
    { id: 'hailuo-01', label: 'hailuo-01', badge: 'builtin' }
  ]

  // 生成模拟（useGenerate 基座 hook）
  const { loading, setLoading, error, setError, start: onGenerate, stop: onStop } = useGenerate({
    onDone: () => setVideoUrl('https://www.w3schools.com/html/mov_bbb.mp4'),
    delay: 2200
  })

  const totalCost = Math.round(0.5 * (parseInt(seconds) || 10))
  const onUpload = () => fileRef.current?.click()

  // hover 操作栏按钮
  const toolbarButtons = [
    { key: 'upload', icon: <Plus size={14} />, title: '上传图片、视频或音频素材', onClick: onUpload },
    ...(videoUrl
      ? [
          { key: 'fullscreen', icon: <Expand size={14} />, title: '全屏播放' },
          { key: 'download', icon: <Download size={14} />, title: '下载' },
          {
            key: 'jianying',
            icon: <JianyingIcon size={14} />,
            title: '发送到剪映素材库',
            hoverClass: 'hover:text-emerald-400',
            onClick: () => console.log('发送到剪映素材库')
          },
          { key: 'delete', icon: <Trash2 size={14} />, title: '删除', hoverClass: 'hover:text-red-500', onClick: () => setVideoUrl('') }
        ]
      : [])
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="特惠视频"
      icon={<Clapperboard size={11} className="text-gray-500" />}
      selected={selected}
      minWidth={200}
      minHeight={200}
      aspectRatio={ratio}
      sizeMode="area-fixed"
      baseSize={380}
      className="min-w-[200px] min-h-[200px]"
    >
      {/* hover 操作栏（loading 时隐藏） */}
      {!loading && <HoverToolbar buttons={toolbarButtons} loading={false} />}

      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*,video/*,audio/*" />

      {/* 主显示区：flex-1 填满 wrapper，wrapper 宽高由 useSizeSync(area-fixed) 按比例同步，
          主框宽=wrapper宽，高=wrapper高 → 自然成比例，端口不跑偏，无需主框自己定 ratio。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
      <div
        className="relative cursor-pointer group/display flex flex-col w-full flex-1 min-h-0"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${videoUrl ? '' : 'bg-[#121212]'}`}>
          {/* 性能模式媒体降级：缩小时隐藏视频（复刻官方"图片视频已隐藏"） */}
          {videoUrl && !loading && !error && hideVideo && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-[#151515]">
              <Clapperboard size={24} className="text-gray-700" />
              <span className="text-[10px] text-gray-500">性能模式已隐藏</span>
            </div>
          )}
          {videoUrl && !hideVideo && (
            <>
              <video
                src={videoUrl}
                poster={data.poster || ''}
                className={`max-w-full w-full h-full object-contain block ${loading ? 'opacity-50 blur-sm' : ''}`}
                controls={false}
                autoPlay={false}
                muted={false}
              />
              {!loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto" title="播放视频">
                    <Play className="text-white w-6 h-6" fill="currentColor" />
                  </div>
                </div>
              )}
            </>
          )}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121212]/80 gap-2 z-10">
              <Loader2 size={28} className="animate-spin" style={{ color: 'rgb(210,2,7)' }} />
              <span className="text-xs text-gray-300">生成中... 45%</span>
            </div>
          )}
          {!videoUrl && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none">
              <Clapperboard size={80} className="text-gray-700" strokeWidth={1.2} />
            </div>
          )}
          {error && !loading && !videoUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-xs font-medium max-w-full break-words">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。 */}
      <ExpandablePanel expanded={expanded} minWidth={500}>
        <div className="space-y-3">
          {/* 素材缩略图（仅显示真实上游/上传的素材，无上游则隐藏） */}
          {(connected.images.length > 0 || connected.texts.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-1">
              {connected.images.map((img, i) => (
                <div key={img.id || i} className="w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan" title="连线图片 (点击底部标签插入到提示词)">
                  <img src={img.url} alt="Ref" className="w-full h-full object-cover pointer-events-none" />
                </div>
              ))}
              {connected.texts.map((t, i) => (
                <div key={t.id || i} className="h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text" title={t.text || t.label}>
                  <LinkIcon size={10} />
                  <span className="max-w-[80px] truncate">{t.label || '参考文本'}</span>
                </div>
              ))}
            </div>
          )}

          {/* 提示词输入 */}
          <div className="flex items-start gap-2">
            {/* 外层不设固定 height，让 textarea 撑开 → 手柄拖拽纵向能正确拉高（生图 PromptInput 同款） */}
            <div className="flex-1 nodrag relative shrink-0">
              <textarea
                ref={promptInputRef}
                className="w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag resize-none"
                style={{
                  width: data.inputWidth ? `${data.inputWidth}px` : undefined,
                  height: data.inputHeight ? `${data.inputHeight}px` : '80px',
                  minHeight: '80px',
                  overflow: 'auto'
                }}
                placeholder="描述你想要的视频内容 (输入 @ 调出素材)..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onWheel={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* 底部控制 */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag">
            <div className="flex items-center gap-1.5 overflow-visible z-50">
              {/* 比例/分辨率/时长（ref 绑外层 relative，点外部才关） */}
              <div ref={ratioMenuRef} className="relative nodrag flex items-center">
                <button
                  className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setShowRatioMenu((v) => !v) }}
                  title="选择比例和时长"
                >
                  <Settings size={12} className="opacity-70" />
                  <span className="whitespace-nowrap">{ratio} · {resolution} · {seconds}s</span>
                </button>
                {showRatioMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2 px-1">比例</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {ratioOptions.map((o) => (
                          <button key={o.value} className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${ratio === o.value ? 'bg-[#444] text-white' : 'bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`} onClick={() => setRatio(o.value)}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2 px-1">分辨率</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {resOptions.map((r) => (
                          <button key={r} className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${resolution === r ? 'bg-[#444] text-white' : 'bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`} onClick={() => setResolution(r)}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 mb-2 px-1">时长 (秒)</div>
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {durationOptions.map((d) => (
                          <button key={d} type="button" className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${String(d) === seconds ? 'bg-[#444] text-white' : 'bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`} onClick={() => setSeconds(d)}>{d}s</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模型选择（基座 ModelSelect） */}
              <ModelSelect value={selectedModel} onChange={setSelectedModel} models={models} />

              {/* 预设提示词 */}
              <div className="relative nodrag flex items-center">
                <div className="w-[1px] h-3 bg-[#444] mr-1.5" />
                <button
                  className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
                  title="预设提示词"
                >
                  <Sparkles size={10} className="text-blue-400" />
                  <span>预设</span>
                </button>
              </div>
            </div>

            {/* 生成 / 停止（基座 GenerateButton） */}
            <GenerateButton
              loading={loading}
              onGenerate={onGenerate}
              onStop={onStop}
              onRefresh={onStop}
              cost={totalCost}
              costColor="text-yellow-300"
            />
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸（复刻 As.jsx:2055 _Component23）。
            targetRef=textarea（promptInputRef），onResizeEnd → onInputResize 写回
            node.data.inputWidth/inputHeight，textarea 的 inline style 读这个 data 渲染。
            注意：视频 textarea 外层不能设固定 height（否则纵向拖不动），
            高度完全由 data.inputHeight 驱动。输入框不参与端口定位，只写 data。 */}
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
