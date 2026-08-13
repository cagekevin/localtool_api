import React, { useState } from 'react'
import { Loader2, Wand2, User, Image as ImageIcon, Package, Plus, MoreVertical, Upload, RefreshCw, Trash2 } from 'lucide-react'
import { ZgPrompt } from '../base/scriptBoxPrompts.js'
import { useOutsideClick } from '../base/hooks.js'

/**
 * 剧本盒子 步骤2「准备资产」：角色/场景/道具三栏 + 资产卡(选中框/视频上传状态/more菜单) +
 * 工具栏(风格/生图模型/上传全部/批量生图带选中数) + 抽屉编辑 + 双击提示词面板（复刻原型 renderV2）。
 *
 * 数据只读 node.data：
 *  - assets[].picked  选中态（批量用，存 node.data）
 *  - assets[].videoStatus  uploading/uploaded/failed
 *  - pickedCount 全局选中数（存 node.data）
 * 编辑经 updateData；生成/上传经 callbacks.onGenerateAssetImage / onGenerateAllAssetImages /
 * onUploadAllVideoAssets / onRetryVideoAssetUpload。
 */
export default function StepAssets({ data, updateData, callbacks }) {
  const d = data || {}
  const assets = d.assets || []
  const pickedCount = d.pickedCount || 0
  const [drawerIdx, setDrawerIdx] = useState(null)
  const [promptEditorIdx, setPromptEditorIdx] = useState(null) // 双击提示词面板

  const CATS = [
    { k: 'character', n: '角色', icon: <User size={12} /> },
    { k: 'scene', n: '场景', icon: <ImageIcon size={12} /> },
    { k: 'prop', n: '道具', icon: <Package size={12} /> }
  ]

  const setGlobalStyle = (v) => updateData({ globalStyle: v })
  const setAssetModel = (m) => updateData({ assetModelSettings: { ...(d.assetModelSettings || {}), globalModel: m } })

  // 切换选中
  const togglePick = (id) => {
    const next = assets.map((a) => (a.id === id ? { ...a, picked: !a.picked } : a))
    updateData({ assets: next, pickedCount: next.filter((a) => a.picked).length })
  }
  // 删除资产
  const delAsset = (id) => {
    const next = assets.filter((a) => a.id !== id)
    updateData({ assets: next, pickedCount: next.filter((a) => a.picked).length })
  }
  // 批量生图：用选中集（未选则全选）
  const batchGen = () => {
    const picked = assets.filter((a) => a.picked)
    const target = picked.length ? picked : assets
    target.forEach((a) => callbacks.onGenerateAssetImage?.(a.id))
  }
  // 上传全部素材
  const uploadAll = () => callbacks.onUploadAllVideoAssets?.()
  // 上传单个资产视频
  const uploadOne = (id) => {
    updateData({ assets: assets.map((a) => (a.id === id ? { ...a, videoStatus: 'uploading' } : a)) })
    setTimeout(() => updateData({ assets: assets.map((a) => (a.id === id ? { ...a, videoStatus: 'uploaded' } : a)) }), 600)
  }
  const retryUpload = (id) => callbacks.onRetryVideoAssetUpload?.(id)

  return (
    <div className="flex flex-col gap-3">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
        <span>统一风格</span>
        <input value={d.globalStyle || ''} onChange={(e) => setGlobalStyle(e.target.value)} className="w-36 bg-[#161616] border border-[#333] rounded-md px-2 py-1 text-gray-200 outline-none nodrag" />
        <span className="ml-2">生图模型</span>
        <select value={d.assetModelSettings?.globalModel || 'gpt-image-2-low'} onChange={(e) => setAssetModel(e.target.value)} className="bg-[#161616] border border-[#333] rounded-md px-1 py-1 text-gray-200 text-[10px] outline-none nodrag">
          {['gpt-image-2-low', 'gpt-image-2', 'gpt-image-2-high'].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex-1" />
        <button className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-300 bg-[#222] hover:bg-[#2a2a2a] rounded" onClick={uploadAll}><Upload size={10} /> 上传全部素材</button>
        <button className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-300 bg-[#222] hover:bg-[#2a2a2a] rounded" onClick={batchGen}>
          <Wand2 size={10} /> 批量生图{pickedCount ? `(${pickedCount})` : ''}
        </button>
      </div>

      {/* 三栏资产 */}
      <div className="grid grid-cols-3 gap-4">
        {CATS.map((c) => {
          const list = assets.filter((a) => a.category === c.k)
          return (
            <div key={c.k} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-300">{c.icon}<span>{c.n}</span><span className="text-gray-500">{list.length}</span></div>
              <div className="flex flex-col gap-1.5 max-h-[360px] overflow-auto custom-scrollbar">
                {list.map((a) => {
                  const gi = assets.indexOf(a)
                  return (
                    <AssetCard
                      key={a.id} asset={a} idx={gi} data={d}
                      updateData={updateData} callbacks={callbacks}
                      onOpen={() => setDrawerIdx(gi)}
                      onTogglePick={() => togglePick(a.id)}
                      onDel={() => delAsset(a.id)}
                      onUpload={() => uploadOne(a.id)}
                      onRetry={() => retryUpload(a.id)}
                      onEditPrompt={() => setPromptEditorIdx(gi)}
                    />
                  )
                })}
                <button className="flex flex-col items-center justify-center h-14 border border-dashed border-[#333] hover:border-[#555] rounded-lg text-gray-500 hover:text-gray-300" onClick={() => addAsset(updateData, c.k, assets)}>
                  <Plus size={13} /> 新增{c.n}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 抽屉 */}
      {drawerIdx !== null && assets[drawerIdx] && (
        <AssetDrawer asset={assets[drawerIdx]} idx={drawerIdx} data={d} updateData={updateData} onGen={() => callbacks.onGenerateAssetImage?.(assets[drawerIdx].id)} onClose={() => setDrawerIdx(null)} />
      )}

      {/* 双击提示词编辑面板 */}
      {promptEditorIdx !== null && assets[promptEditorIdx] && (
        <PromptEditor asset={assets[promptEditorIdx]} idx={promptEditorIdx} data={d} updateData={updateData} onGen={() => callbacks.onGenerateAssetImage?.(assets[promptEditorIdx].id)} onClose={() => setPromptEditorIdx(null)} />
      )}
    </div>
  )
}

/** 新增资产（按当前风格生成 prompt） */
function addAsset(updateData, cat, assets) {
  const name = `${cat === 'character' ? '角色' : cat === 'scene' ? '场景' : '道具'}${assets.length + 1}`
  const newAsset = {
    id: `${cat}-${Date.now()}`,
    category: cat,
    name, description: '', prompt: '',
    imageUrl: '', thumbnailUrl: '',
    has: false, loading: false, picked: false, videoStatus: ''
  }
  updateData({ assets: [...assets, newAsset] })
}

/** 资产卡：缩略图 + 选中框 + 名称/描述 + 视频状态 + more 菜单 */
function AssetCard({ asset, idx, data, updateData, callbacks, onOpen, onTogglePick, onDel, onUpload, onRetry, onEditPrompt }) {
  const [more, setMore] = useState(false)
  const moreRef = React.useRef(null)
  useOutsideClick(moreRef, more, () => setMore(false))

  return (
    <div className={`flex items-center gap-2 p-2 bg-[#181818] border rounded-lg transition-colors ${asset.picked ? 'border-emerald-500/60' : 'border-[#2a2a2a] hover:border-[#444]'}`}>
      {/* 选中框 */}
      <div className="flex flex-col items-center gap-1">
        <input type="checkbox" checked={!!asset.picked} onChange={onTogglePick} className="nodrag cursor-pointer" />
      </div>
      {/* 缩略图（点击打开抽屉） */}
      <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden bg-[#222] flex items-center justify-center cursor-pointer" onClick={onOpen}>
        {asset.loading ? <Loader2 size={13} className="animate-spin text-gray-400" />
          : asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
            : asset.has ? <span className="text-emerald-400 text-[12px]">✓</span>
              : <span className="text-[10px] text-gray-500">+ 待生成</span>}
      </div>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
        <div className="text-[11px] text-gray-200 truncate">{asset.name}</div>
        <div className="text-[9px] text-gray-500 truncate">{asset.description || '双击编辑'}</div>
        {/* 视频上传状态 */}
        {asset.videoStatus && (
          <div className={`flex items-center gap-1 text-[9px] mt-0.5 ${asset.videoStatus === 'uploaded' ? 'text-emerald-400' : asset.videoStatus === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
            {asset.videoStatus === 'uploading' && <Loader2 size={8} className="animate-spin" />}
            {asset.videoStatus === 'uploaded' ? '✓ 视频已上传' : asset.videoStatus === 'failed' ? '✗ 上传失败' : '上传中…'}
          </div>
        )}
      </div>
      {/* 生成按钮 */}
      <button className="text-gray-600 hover:text-gray-300 p-0.5" title="生成参考图" onClick={(e) => { e.stopPropagation(); callbacks.onGenerateAssetImage?.(asset.id) }}><Wand2 size={11} /></button>
      {/* more 菜单 */}
      <div className="relative" ref={moreRef}>
        <button className="text-gray-600 hover:text-gray-300 p-0.5" title="更多" onClick={(e) => { e.stopPropagation(); setMore(!more) }}><MoreVertical size={11} /></button>
        {more && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1c1c1e] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={<RefreshCw size={11} />} text="重新生成" onClick={() => { callbacks.onGenerateAssetImage?.(asset.id); setMore(false) }} />
            <MenuItem icon={<Upload size={11} />} text="上传视频" onClick={() => { onUpload(); setMore(false) }} />
            {asset.videoStatus === 'failed' && <MenuItem icon={<RefreshCw size={11} />} text="重试上传" onClick={() => { onRetry(); setMore(false) }} />}
            <MenuItem icon={<Wand2 size={11} />} text="编辑提示词" onClick={() => { onEditPrompt(); setMore(false) }} />
            <div className="h-px bg-white/[0.04] my-1" />
            <MenuItem danger icon={<Trash2 size={11} />} text="删除" onClick={() => { onDel(); setMore(false) }} />
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({ icon, text, onClick, danger }) {
  return (
    <button className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-[#2a2a2a]'}`} onClick={onClick}>{icon}{text}</button>
  )
}

/** 资产抽屉编辑（名称/描述/提示词 + 生图），含改名联动 @旧名→@新名 */
function AssetDrawer({ asset, idx, data, updateData, onGen, onClose }) {
  const [name, setName] = useState(asset.name)
  const [desc, setDesc] = useState(asset.description)
  const [prompt, setPrompt] = useState(asset.prompt)

  const save = (alsoGen) => {
    let shots = data.shots || []
    if (name !== asset.name) {
      shots = shots.map((s) => ({ ...s, description: (s.description || '').split('@').map((seg, k) => k ? (seg.startsWith(asset.name) ? '@' + name + seg.slice(asset.name.length) : '@' + seg) : seg).join('') }))
    }
    const assets = (data.assets || []).map((a, i) => (i === idx ? { ...a, name, description: desc, prompt: prompt || ZgPrompt(a.category, desc, data.globalStyle, data.customAssetTemplates) } : a))
    updateData({ assets, shots })
    if (alsoGen) onGen()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-[#1c1c1e] border-l border-[#333] p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] text-gray-200">编辑资产</div>
          <button className="text-gray-500 hover:text-white text-[16px]" onClick={onClose}>×</button>
        </div>
        <div className="flex flex-col gap-3 text-[11px]">
          <label className="text-gray-400">名称
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-[#161616] border border-[#333] rounded-md px-2 py-1.5 text-gray-200 outline-none nodrag" />
          </label>
          <label className="text-gray-400">描述
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full mt-1 h-20 bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
          </label>
          <label className="text-gray-400">生图提示词
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full mt-1 h-40 bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
          </label>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button className="flex-1 py-2 bg-[#27272a] hover:bg-[#313135] text-gray-200 text-[12px] rounded-lg" onClick={() => save(false)}>保存</button>
          <button className="flex-1 py-2 bg-[#3a3a3a] hover:bg-[#454545] text-gray-200 text-[12px] rounded-lg" onClick={() => save(true)}>保存并生图</button>
        </div>
      </div>
    </div>
  )
}

/** 双击提示词编辑面板（editAssetPrompt） */
function PromptEditor({ asset, idx, data, updateData, onGen, onClose }) {
  const [prompt, setPrompt] = useState(asset.prompt)
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#1c1c1e] border border-[#333] rounded-xl p-4 w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[12px] text-gray-300 mb-2">编辑「{asset.name}」生图提示词</div>
        <textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-40 bg-[#161616] border border-[#333] rounded-lg p-2 text-[12px] text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
        <div className="flex justify-end gap-2 mt-3">
          <button className="px-3 py-1 text-[11px] text-gray-400 hover:text-white" onClick={onClose}>取消</button>
          <button className="px-3 py-1 text-[11px] bg-[#2a2a2a] hover:bg-[#333] text-gray-200 rounded-md" onClick={() => { updateData({ assets: (data.assets || []).map((a, i) => (i === idx ? { ...a, prompt } : a)) }); onClose() }}>确定</button>
          <button className="px-3 py-1 text-[11px] bg-[#3a3a3a] hover:bg-[#454545] text-gray-200 rounded-md" onClick={() => { updateData({ assets: (data.assets || []).map((a, i) => (i === idx ? { ...a, prompt } : a)) }); onGen() }}>确定并生成</button>
        </div>
      </div>
    </div>
  )
}
