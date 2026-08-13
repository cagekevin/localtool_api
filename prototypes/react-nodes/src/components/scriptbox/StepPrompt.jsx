import React, { useState } from 'react'
import { Loader2, Image as ImageIcon, Video, LayoutGrid, Columns2, RefreshCw, Link2 } from 'lucide-react'
import { dialogueText } from '../base/scriptBoxPrompts.js'

/**
 * 剧本盒子 步骤3「合成提示词」：列表/单镜头双视图 + 每镜卡片（生图 prompt/生视频 prompt 双击编辑 + 宫格选择 + 生成）+
 * 已连线面板（复刻原型 renderV3）。
 */
export default function StepPrompt({ data, updateData, callbacks }) {
  const d = data || {}
  const shots = d.shots || []
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null) // { idx, field, title }
  const [editVal, setEditVal] = useState('')
  const [gridPick, setGridPick] = useState({}) // idx -> grid 模式
  const [selShots, setSelShots] = useState(new Set())

  const patchShot = (idx, field, val) => {
    const shots2 = shots.map((s, i) => {
      if (i !== idx) return s
      return typeof field === 'object' ? { ...s, ...field } : { ...s, [field]: val }
    })
    updateData({ shots: shots2 })
  }
  const toggleSel = (idx) => {
    const s2 = new Set(selShots)
    if (s2.has(idx)) s2.delete(idx)
    else s2.add(idx)
    setSelShots(s2)
  }

  const openField = (idx, field, title) => { setEditing({ idx, field, title }); setEditVal(String(shots[idx]?.[field] ?? '')) }
  const commitField = () => { if (editing) patchShot(editing.idx, editing.field, editVal); setEditing(null) }

  const cardFor = (s, i) => (
    <div className="flex flex-col gap-2 p-3 bg-[#181818] border border-[#2a2a2a] rounded-lg">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="px-1.5 py-0.5 bg-[#2a2a2a] rounded text-gray-300">镜头 {s.index}</span>
        <span className="text-gray-500">{s.duration}</span>
        {s.connImg && <span className="text-emerald-400">图✓</span>}
        {s.connVid && <span className="text-blue-400">视频✓</span>}
        <div className="flex-1" />
        <button className="text-gray-500 hover:text-white" title={selShots.has(i) ? '取消选择' : '选择'} onClick={() => toggleSel(i)}>{selShots.has(i) ? '☑' : '☐'}</button>
      </div>
      <div className="text-[11px] text-gray-400 leading-relaxed">{s.description}</div>
      {(s.dialogue || []).length > 0 && <div className="text-[10px] text-gray-500 italic">「{dialogueText(s.dialogue)}」</div>}

      {/* 生图宫格选择（grid: 0/4/9） */}
      <div className="flex items-center gap-1.5">
        {[0, 4, 9].map((g) => (
          <button key={g} onClick={() => patchShot(i, 'grid', g)} className={`px-2 py-0.5 text-[9px] rounded border ${s.grid === g ? 'border-white/40 text-white bg-[#2a2a2a]' : 'border-[#333] text-gray-500'}`}>{g === 0 ? '单图' : `${g}宫格`}</button>
        ))}
        <div className="flex-1" />
        {s.loading ? <Loader2 size={12} className="animate-spin text-gray-400" /> : s.imageUrl ? <img src={s.imageUrl} className="w-8 h-8 object-cover rounded" /> : null}
      </div>

      {/* prompt 区 */}
      <div className="grid grid-cols-2 gap-2">
        <PromptBox label="生图提示词" text={s.prompt} loading={s.promptLoading} onEdit={() => openField(i, 'prompt', '生图提示词')} onGen={() => handleGenImg(callbacks, patchShot, i)} />
        <PromptBox label="生视频提示词" text={s.videoPrompt} loading={s.promptLoading} onEdit={() => openField(i, 'videoPrompt', '生视频提示词')} onGen={() => handleGenVid(callbacks, patchShot, i)} />
      </div>

      {/* 操作 */}
      <div className="flex gap-1.5">
        <button className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-300 bg-[#222] hover:bg-[#2a2a2a] rounded" onClick={() => callbacks.onGenerateShotPrompts?.([s.id])}><RefreshCw size={10} /> 重新生成</button>
        <button className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-300 bg-[#222] hover:bg-[#2a2a2a] rounded" onClick={() => callbacks.onConnectShot?.(s.id)}><Link2 size={10} /> 连下游</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* 视图切换 + 批量 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-[#181818] rounded-lg p-0.5">
          <button className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-md ${view === 'list' ? 'bg-[#2a2a2a] text-white' : 'text-gray-400'}`} onClick={() => setView('list')}><Columns2 size={11} /> 列表</button>
          <button className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-md ${view === 'grid' ? 'bg-[#2a2a2a] text-white' : 'text-gray-400'}`} onClick={() => setView('grid')}><LayoutGrid size={11} /> 单镜头</button>
        </div>
        <div className="flex-1" />
        {selShots.size > 0 && (
          <button className="px-2 py-1 text-[10px] text-gray-300 bg-[#222] hover:bg-[#2a2a2a] rounded" onClick={() => callbacks.onConnectShots?.([...selShots].map((i) => shots[i].id))}>
            连选中的 {selShots.size} 镜下游
          </button>
        )}
        <span className="text-[11px] text-gray-500">{shots.length} 镜</span>
      </div>

      {/* 内容 */}
      {shots.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-[12px]">暂无分镜，请先在「确认镜头」步骤生成</div>
      ) : view === 'list' ? (
        <div className="flex flex-col gap-2 max-h-[520px] overflow-auto custom-scrollbar">{shots.map((s, i) => cardFor(s, i))}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[520px] overflow-auto custom-scrollbar">{shots.map((s, i) => cardFor(s, i))}</div>
      )}

      {/* 已连线面板 */}
      {(d.connected || []).length > 0 && (
        <div className="text-[11px] text-gray-500 border-t border-[#2a2a2a] pt-2">
          <div className="mb-1 text-gray-400">已连线</div>
          {d.connected.map((c, i) => <div key={i} className="text-gray-500">镜头{c.shotId} · {c.type} · {c.nodeId}</div>)}
        </div>
      )}

      {/* 双击编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-[#1c1c1e] border border-[#333] rounded-xl p-4 w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] text-gray-300 mb-2">编辑{editing.title}</div>
            <textarea autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-full h-36 bg-[#161616] border border-[#333] rounded-lg p-2 text-[12px] text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-1 text-[11px] text-gray-400 hover:text-white" onClick={() => setEditing(null)}>取消</button>
              <button className="px-3 py-1 text-[11px] bg-[#2a2a2a] hover:bg-[#333] text-gray-200 rounded-md" onClick={commitField}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 提示词展示 + 生成按钮 */
function PromptBox({ label, text, loading, onEdit, onGen }) {
  return (
    <div className="flex flex-col gap-1 bg-[#131313] rounded p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <button className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-white" onClick={onGen}>{loading ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />} 生成</button>
      </div>
      <div className="text-[10px] text-gray-400 leading-relaxed line-clamp-3 cursor-text hover:bg-[#1a1a1a] rounded px-1 -mx-1" onDoubleClick={onEdit} title="双击编辑">
        {text || <span className="text-gray-600">双击编辑</span>}
      </div>
    </div>
  )
}

/** 生成图片（假实现：写回占位图） */
function handleGenImg(callbacks, patchShot, i) {
  patchShot(i, 'loading', true)
  setTimeout(() => patchShot(i, { loading: false, imageUrl: `https://picsum.photos/seed/shotprompt-${i}-${Date.now()}/200/200` }), 500)
}

/** 生成视频（假实现：仅标记 connVid） */
function handleGenVid(callbacks, patchShot, i) {
  patchShot(i, 'connVid', true)
}
