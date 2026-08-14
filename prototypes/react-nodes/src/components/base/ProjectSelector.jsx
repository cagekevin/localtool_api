import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, FolderOpen, Trash2, Pencil } from 'lucide-react'
import { useProjects, createProject, switchProject, deleteProject, renameProject, getCurrentProject } from './projectStore.js'
import { showToast } from './toastStore.js'

/**
 * 画布顶部中央项目选择器（对齐官方 Vr.jsx project-selector）。
 * 显示当前项目名 + 下拉箭头；hover 展开菜单：
 *  - 项目列表（点击切换）
 *  - 底部「新建项目」+ 按钮
 *  - 每项 hover 出现 重命名 / 删除
 * 新建/重命名共用一个小弹窗（输入项目名）。
 *
 * @param {object} props
 *  - onSwitch  切换项目回调（由 App 负责保存/加载画布快照）
 *  - onCreate  新建项目回调（App 清空画布）；缺省只更新 store
 */
export default function ProjectSelector({ onSwitch, onCreate }) {
  const { projects, currentProjectId } = useProjects()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(null) // null | {mode:'create'} | {mode:'rename', id, name}
  const [name, setName] = useState('')
  const wrapRef = useRef(null)

  const current = getCurrentProject()

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  const handleSwitch = (id) => {
    if (id === currentProjectId) { setOpen(false); return }
    if (onSwitch) onSwitch(id)
    else switchProject(id)
    setOpen(false)
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('请输入项目名', { type: 'warning' }); return }
    const proj = createProject(trimmed)
    if (onCreate) onCreate(proj)
    setModal(null)
    setName('')
    showToast(`已创建「${trimmed}」`, { type: 'success' })
  }

  const openRename = (id) => {
    const p = projects.find((x) => x.id === id)
    if (!p) return
    setModal({ mode: 'rename', id, name: p.name })
    setName(p.name)
    setOpen(false)
  }

  const handleRename = () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('项目名不能为空', { type: 'warning' }); return }
    renameProject(modal.id, trimmed)
    setModal(null)
    showToast('已重命名', { type: 'success' })
  }

  const handleDelete = (id) => {
    if (projects.length <= 1) { showToast('至少保留一个项目', { type: 'warning' }); return }
    if (!window.confirm('确定删除此项目吗？')) return
    const ok = deleteProject(id)
    if (ok && onSwitch && id === currentProjectId) onSwitch(getCurrentProject().id)
    setOpen(false)
  }

  return (
    <>
      <div ref={wrapRef} className="fixed top-2 left-1/2 -translate-x-1/2 z-[800] select-none">
        <div
          className="flex items-center gap-1 bg-[#191919] border border-[#2a2a2a] rounded-full pl-3.5 pr-2.5 py-1.5 shadow-lg cursor-pointer hover:bg-[#262626]"
          onClick={() => setOpen((v) => !v)}
        >
          <FolderOpen size={14} className="text-[#aaa]" />
          <span className="text-[13px] text-white/90 max-w-[140px] truncate">{current.name || '默认项目'}</span>
          <ChevronDown size={13} className={`text-[#666] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>

        {/* 下拉菜单 */}
        {open && (
          <div className="absolute left-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden py-1 nowheel nopan nodrag animate-panel-in">
            <div className="px-3 py-1.5 text-[10px] text-[#666] tracking-wide">项目列表</div>
            <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
              {projects.map((p) => {
                const active = p.id === currentProjectId
                return (
                  <div
                    key={p.id}
                    className={`group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${active ? 'bg-[#222]' : 'hover:bg-[#222]'}`}
                    onClick={() => handleSwitch(p.id)}
                  >
                    <FolderOpen size={13} className={`flex-shrink-0 ${active ? 'text-blue-400' : 'text-[#666]'}`} />
                    <span className={`flex-1 text-[12px] truncate ${active ? 'text-white' : 'text-[#bbb]'}`}>{p.name}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    {/* 编辑/删除：绝对定位 + opacity 切换，不占位 → hover 不影响行布局/高度 */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-[#222]/90 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                      <button className="w-5 h-5 flex items-center justify-center rounded text-[#888] hover:text-white hover:bg-[#333] cursor-pointer border-none" title="重命名" onClick={(e) => { e.stopPropagation(); openRename(p.id) }}>
                        <Pencil size={11} />
                      </button>
                      <button className="w-5 h-5 flex items-center justify-center rounded text-[#888] hover:text-red-400 hover:bg-red-500/10 cursor-pointer border-none" title="删除" onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#2a2a2a] mt-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#222] hover:text-white transition-colors cursor-pointer border-none"
                onClick={() => { setModal({ mode: 'create' }); setName(''); setOpen(false) }}
              >
                <Plus size={14} className="text-blue-400" /> 新建项目
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 新建/重命名弹窗 */}
      {modal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="w-[340px] bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-white m-0">{modal.mode === 'create' ? '新建项目' : '重命名项目'}</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') modal.mode === 'create' ? handleCreate() : handleRename() }}
              placeholder="输入项目名"
              autoFocus
              className="bg-[#141414] border border-[#333] rounded-[10px] px-3 py-2.5 text-[#e5e5e5] text-[13px] outline-none focus:border-[#555] box-border"
            />
            <div className="flex items-center justify-end gap-2.5">
              <button className="px-4 py-2 rounded-[10px] text-xs bg-[#2a2a2a] text-[#ccc] hover:bg-[#333] cursor-pointer border-none" onClick={() => setModal(null)}>取消</button>
              <button className="px-4 py-2 rounded-[10px] text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer border-none" onClick={modal.mode === 'create' ? handleCreate : handleRename}>{modal.mode === 'create' ? '创建' : '保存'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes panelIn { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-panel-in { animation: panelIn 0.18s ease-out; }
      `}</style>
    </>
  )
}
