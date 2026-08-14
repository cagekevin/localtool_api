import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Plus, Upload, X, FileText, Music, Trash2, Play, Image as ImageIcon } from 'lucide-react'
import { useAssets, FOLDERS, filterByFolder, addAssets, removeAsset, clearAssets, detectAssetType } from './assetStore.js'
import { showToast } from './toastStore.js'

const TYPE_BADGE = {
  image: { icon: ImageIcon, cls: 'text-blue-400 bg-blue-500/10' },
  video: { icon: Play, cls: 'text-purple-400 bg-purple-500/10' },
  audio: { icon: Music, cls: 'text-green-400 bg-green-500/10' }
}

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 素材库 tab：顶部一排目录 pill（全部/AI生成/人物/场景/道具/素材池），
 * 点击切换网格展示；支持上传/拖入（进素材池，不建画布节点）；点击缩略图预览。
 */
export default function AssetLibrary() {
  const assets = useAssets()
  const [folder, setFolder] = useState('all')
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const current = useMemo(() => {
    const f = FOLDERS.find((x) => x.key === folder)
    return filterByFolder(assets, f?.folder ?? null)
  }, [assets, folder])

  const handleFiles = useCallback((files) => {
    const items = Array.from(files).map((f) => {
      const url = URL.createObjectURL(f)
      return { url, name: f.name, type: detectAssetType(f), size: f.size }
    })
    if (items.length === 0) return
    addAssets(items, 'materials') // 默认落素材池
    showToast(`已添加 ${items.length} 个素材`, { type: 'success' })
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative" onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {/* 目录 pill 顶部一排 */}
      <div className="px-2.5 pt-2.5 pb-2 flex-shrink-0">
        <div className="flex gap-1.5 flex-wrap">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-all cursor-pointer border-none ${folder === f.key ? 'bg-white text-[#141414] font-medium' : 'bg-[#1f1f1f] text-[#999] hover:text-[#ddd]'}`}
              onClick={() => setFolder(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 上传区 */}
      <div className="px-2.5 pb-2 flex-shrink-0">
        <button
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#333] text-[12px] text-[#888] hover:border-[#555] hover:text-[#ccc] transition-colors cursor-pointer bg-[#161616]/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} /> 上传素材 / 拖入文件
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
      </div>

      {/* 素材网格 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-2.5">
        {current.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#666] text-sm">
            该目录暂无素材，上传或拖入文件
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {current.map((a) => {
              const badge = TYPE_BADGE[a.type] || TYPE_BADGE.image
              const BadgeIcon = badge.icon
              return (
                <div key={a.id} className="group relative aspect-square bg-[#1a1a1a] border border-[#242424] rounded-xl overflow-hidden cursor-pointer hover:border-[#3a3a3a] transition-colors" onClick={() => setPreview(a)}>
                  {a.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {a.url ? (
                        <video src={a.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <Play size={20} className="text-[#666]" />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full bg-black/45 flex items-center justify-center">
                          <Play size={12} className="text-white ml-0.5" />
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: a.url ? `url(${a.url})` : undefined }}>
                      {!a.url && <div className="w-full h-full flex items-center justify-center text-[#555]"><FileText size={18} /></div>}
                    </div>
                  )}
                  {/* 类型角标 */}
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center ${badge.cls}`}>
                    <BadgeIcon size={9} />
                  </span>
                  {/* 删除 */}
                  <button
                    className="absolute top-1 right-1 w-4 h-4 rounded bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                    onClick={(e) => { e.stopPropagation(); removeAsset(a.id); showToast('已删除', { type: 'success' }) }}
                    title="删除"
                  >
                    <X size={9} />
                  </button>
                  {/* 底部名称 */}
                  <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-[9px] text-white/80 truncate m-0">{a.name}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 清空当前目录 */}
      {current.length > 0 && (
        <div className="px-2.5 pb-2.5 flex-shrink-0">
          <button
            className="w-full py-1.5 rounded-lg text-[11px] text-[#666] hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer border-none bg-transparent"
            onClick={() => { clearAssets(); showToast('已清空素材库', { type: 'success' }) }}
          >
            <Trash2 size={11} className="inline mr-1" />清空素材库
          </button>
        </div>
      )}

      {/* 拖入高亮 */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400/50 rounded-lg flex items-center justify-center pointer-events-none">
          <span className="text-blue-300 text-sm">松开以添加素材</span>
        </div>
      )}

      {/* 预览 */}
      {preview && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {preview.type === 'video' ? (
              <video src={preview.url} controls className="max-h-[70vh] max-w-full rounded-lg" />
            ) : preview.type === 'audio' ? (
              <div className="w-[300px] bg-[#1f1f1f] rounded-xl p-6 flex flex-col items-center gap-3">
                <Music size={40} className="text-green-400" />
                <p className="text-xs text-[#aaa] m-0">{preview.name}</p>
                <audio src={preview.url} controls className="w-full" />
              </div>
            ) : (
              <img src={preview.url} alt={preview.name} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
            )}
            <p className="text-xs text-[#999] m-0">{preview.name} · {preview.folder}</p>
            <button className="px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-[#ccc] hover:bg-[#333] text-xs cursor-pointer border-none" onClick={() => setPreview(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}
