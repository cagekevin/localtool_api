import React, { useState, useRef } from 'react'
import {
  Image as ImageIcon, Video, Music, FileText, Plus, ZoomIn, Crop,
  Pencil, Send, Download, Play
} from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'

/**
 * 图片节点（复刻原 xi.jsx / imageNode）
 * 支持 image / video / audio / text / empty 五种内容态。
 * 已迁移到 NodeShell 基座（外壳 + 端口 + 尺寸管理统一）。
 */
export default function ImageNode({ id, data, selected }) {
  const fileRef = useRef(null)
  const url = data.imageUrl || data.url || ''

  // 判断内容类型
  let type = 'empty'
  if (url) {
    if (url.startsWith('data:video/') || /\.(mp4|webm|mov|mkv|avi|m4v)($|\?)/i.test(url)) type = 'video'
    else if (url.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)($|\?)/i.test(url)) type = 'audio'
    else if (url.startsWith('data:text/') || /\.(txt|md|json|csv)($|\?)/i.test(url)) type = 'text'
    else type = 'image'
  }

  const DEMO_IMAGE = data.demoImage || 'https://picsum.photos/seed/imagenode/400/260'
  const defaultTitle = type === 'video' ? '视频' : type === 'audio' ? '音频' : type === 'text' ? '文本文件' : '图片'
  const titleIcon = type === 'video' ? <Video size={11} /> : type === 'audio' ? <Music size={11} /> : type === 'text' ? <FileText size={11} /> : <ImageIcon size={11} />
  const displayUrl = type === 'image' ? url : data.poster || ''

  // hover 操作栏按钮
  const toolbarButtons = [
    {
      key: 'upload',
      icon: <Plus size={14} />,
      title: '上传/替换',
      onClick: () => fileRef.current?.click()
    },
    { key: 'zoom', icon: <ZoomIn size={14} />, title: '放大' },
    { key: 'crop', icon: <Crop size={14} />, title: '裁剪' },
    { key: 'edit', icon: <Pencil size={14} />, title: '编辑' },
    { key: 'send', icon: <Send size={14} />, title: '发送到左侧网站', hoverClass: 'hover:text-blue-400' },
    { key: 'download', icon: <Download size={14} />, title: '下载' }
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle={defaultTitle}
      icon={titleIcon}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      className="min-w-[120px] min-h-[80px]"
    >
      <HoverToolbar buttons={toolbarButtons} />

      <input
        type="file"
        ref={fileRef}
        style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,text/plain"
        multiple
      />

      {/* 主容器 */}
      <div className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full flex flex-col flex-1 ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <div
          className="flex-1 p-0 bg-[#121212] flex items-center justify-center relative overflow-hidden"
          style={{ minHeight: 160 }}
        >
          {/* 图片 */}
          {type === 'image' && displayUrl && (
            <img src={displayUrl} alt="Content" loading="lazy" decoding="async"
              className="w-full h-full object-contain cursor-pointer" draggable={false} />
          )}
          {/* 视频 */}
          {type === 'video' && (
            <>
              <img src={displayUrl || url} alt="video poster" loading="lazy" decoding="async"
                draggable={false} className="w-full h-full object-contain cursor-pointer" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto" title="播放视频">
                  <Play className="text-white w-6 h-6" fill="currentColor" />
                </div>
              </div>
            </>
          )}
          {/* 音频 */}
          {type === 'audio' && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2 gap-2">
              <Music size={24} className="text-blue-500 mb-2" />
              <audio src={url} controls className="w-full max-w-[200px] h-8" />
            </div>
          )}
          {/* 文本文件 */}
          {type === 'text' && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2">
              <FileText size={24} className="text-gray-400 mb-2" />
              <span className="text-[10px] text-gray-500">文本/数据文件</span>
            </div>
          )}
          {/* 空态 */}
          {type === 'empty' && (
            <div
              className="flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all">
                <ImageIcon size={20} className="text-gray-600 group-hover:text-blue-500/80 transition-colors" />
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  )
}
