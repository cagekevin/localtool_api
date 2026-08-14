import React, { useState, useMemo } from 'react'
import { Search, Filter, MoreVertical, Copy, Play, RotateCw, Trash2, X, RefreshCw, ChevronDown, Download, Image as ImageIcon } from 'lucide-react'
import { useTasks, statusDotClass, statusLabel, typeLabel, removeTask, retryTask, clearTasksBy, clearAllTasks } from './taskStore.js'
import { showToast } from './toastStore.js'

const TYPE_ICON = {
  image: ImageIcon,
  video: Play,
  text: ImageIcon
}

// 状态筛选（对齐官方）
const STATUS_FILTERS = [
  { key: '', label: '所有状态' },
  { key: 'running', label: '生成中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' }
]
const TYPE_FILTERS = [
  { key: '', label: '所有类型' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文本' }
]

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return '' }
}

/**
 * 任务中心（对齐官方 Ln.jsx + jn.jsx 卡片）。
 * Header：标题+总数+过滤toggle+关闭；过滤区：搜索/状态下拉/类型下拉/一键清理；
 * 卡片：状态圆点+文案 · 类型+模型 · 操作；提示词；时间；进度条；错误块；缩略图；更多菜单。
 */
export default function TaskCenter() {
  const tasks = useTasks()
  const [showFilter, setShowFilter] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [moreOpenId, setMoreOpenId] = useState(null)
  const [cleanOpen, setCleanOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = tasks
    if (statusFilter === 'running') list = list.filter((t) => t.status === 'running' || t.status === 'pending')
    else if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    if (typeFilter) list = list.filter((t) => t.type === typeFilter)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((t) => (t.prompt || '').toLowerCase().includes(kw) || (t.channelName || '').toLowerCase().includes(kw))
    }
    return list
  }, [tasks, statusFilter, typeFilter, keyword])

  const runningCount = tasks.filter((t) => t.status === 'running' || t.status === 'pending').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  const copyPrompt = (t) => {
    try { navigator.clipboard.writeText(t.prompt || ''); showToast('已复制提示词', { type: 'success' }) } catch { /* ignore */ }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 过滤工具栏（标题由 LeftPanel 外壳提供；这里只放过滤与清理） */}
      <div className="h-[44px] bg-[#252525] border-b border-[#2a2a2a] flex items-center px-3 gap-2 flex-shrink-0">
        <button
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] transition-colors cursor-pointer border-none ${showFilter ? 'bg-[#333] text-white' : 'text-[#aaa] hover:text-white hover:bg-[#2c2c2c]'}`}
          onClick={() => setShowFilter((v) => !v)}
        >
          <Filter size={14} /> 过滤
        </button>
        <span className="text-[11px] text-[#888]">{runningCount} 生成中 · {failedCount} 失败</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-[#888] hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer border-none" onClick={() => setCleanOpen((v) => !v)}>
            <Trash2 size={12} /> 清理 <ChevronDown size={11} />
          </button>
          <div className="relative">
            {cleanOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-20 w-44 nowheel nopan nodrag">
                <CleanItem label={`清理失败任务 (${failedCount})`} onClick={() => { clearTasksBy((t) => t.status === 'failed'); setCleanOpen(false) }} />
                <CleanItem label={`清理已完成任务 (${completedCount})`} onClick={() => { clearTasksBy((t) => t.status === 'completed'); setCleanOpen(false) }} />
                <CleanItem label={`清空全部任务 (${tasks.length})`} onClick={() => { clearAllTasks(); setCleanOpen(false) }} danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 过滤区 */}
      {showFilter && (
        <div className="px-4 py-3 border-b border-[#222] flex flex-col gap-2.5 flex-shrink-0 bg-[#191919]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666]" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索提示词或渠道..."
              className="w-full h-[32px] bg-[#141414] border border-[#333] rounded-lg pl-8 pr-3 text-[#ddd] text-[12px] outline-none focus:border-[#555] box-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 h-[32px] bg-[#141414] border border-[#333] rounded-lg px-2 text-[12px] text-[#ddd] outline-none focus:border-[#555] box-border">
              {STATUS_FILTERS.map((f) => <option key={f.key || 's_all'} value={f.key}>{f.label}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="flex-1 h-[32px] bg-[#141414] border border-[#333] rounded-lg px-2 text-[12px] text-[#ddd] outline-none focus:border-[#555] box-border">
              {TYPE_FILTERS.map((f) => <option key={f.key || 't_all'} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#666] text-sm">暂无任务</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                moreOpen={moreOpenId === t.id}
                onToggleMore={() => setMoreOpenId(moreOpenId === t.id ? null : t.id)}
                onCopy={() => copyPrompt(t)}
                onRetry={() => { retryTask(t.id); setMoreOpenId(null); showToast('已重新排队', { type: 'info' }) }}
                onRemove={() => { removeTask(t.id); setMoreOpenId(null); showToast('已删除', { type: 'success' }) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CleanItem({ label, onClick, danger }) {
  return (
    <button className={`w-full flex items-center px-2 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer border-none text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#bbb] hover:bg-[#2c2c2c] hover:text-white'}`} onClick={onClick}>
      {label}
    </button>
  )
}

// 单条任务卡片（对齐官方 jn.jsx）
function TaskCard({ task, moreOpen, onToggleMore, onCopy, onRetry, onRemove }) {
  const [showData, setShowData] = useState(false)
  const TypeIcon = TYPE_ICON[task.type] || ImageIcon
  const dot = statusDotClass(task.status)
  const statusText = statusLabel(task.status, task.progress)
  const isActive = task.status === 'running' || task.status === 'pending'
  const isCompleted = task.status === 'completed'

  return (
    <div className="px-1.5 py-2 flex flex-col gap-2 border-b border-[#222] last:border-b-0">
      {/* 第一行：状态圆点+文案 · 类型+模型 | 操作 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className={`text-[11px] flex-shrink-0 ${task.status === 'failed' ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-emerald-400'}`}>{statusText}</span>
        <span className="text-[#555]">·</span>
        <span className="flex items-center gap-1 text-[11px] text-[#ccc] flex-shrink-0"><TypeIcon size={11} /> {typeLabel(task.type)}</span>
        {task.modelName && <span className="text-[10px] text-[#777] truncate flex-shrink-0">{task.modelName}</span>}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer border-none" title="复制提示词" onClick={onCopy}>
            <Copy size={12} />
          </button>
          {isActive ? (
            <span className="w-6 h-6 flex items-center justify-center"><RotateCw size={12} className="animate-spin text-blue-400" /></span>
          ) : (
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer border-none" title="刷新状态" onClick={onRetry}>
              <RefreshCw size={12} />
            </button>
          )}
          <div className="relative">
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer border-none" onClick={onToggleMore}>
              <MoreVertical size={13} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-30 w-40 nowheel nopan nodrag">
                {isCompleted && <MenuBtn icon={Download} label="下载结果" onClick={() => showToast('已开始下载', { type: 'info' })} />}
                <MenuBtn icon={RefreshCw} label="再来一次" onClick={onRetry} />
                <MenuBtn icon={Copy} label="复制任务信息" onClick={onCopy} />
                <div className="h-[1px] bg-[#333] my-1" />
                <MenuBtn icon={Trash2} label="删除任务" onClick={onRemove} danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提示词 */}
      <p className="text-[12px] text-[#aaa] leading-[1.5] m-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.prompt || '(无提示词)'}
      </p>

      {/* 时间 */}
      <div className="text-[10px] text-[#666]">{fmtTime(task.createdAt)}</div>

      {/* 运行中进度条 */}
      {isActive && (
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }} />
        </div>
      )}

      {/* 错误块 */}
      {task.status === 'failed' && task.errorMsg && (
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-2 py-1.5">
          <span className="text-[12px]">⚠️</span>
          <span className="text-[11px] text-red-400/90 truncate flex-1">{task.errorMsg}</span>
        </div>
      )}

      {/* 已完成缩略图 */}
      {isCompleted && task.resultUrl && (
        <div className="relative w-full h-[72px] rounded-lg overflow-hidden bg-[#151515] group cursor-pointer" onClick={() => showToast('预览', { type: 'info' })}>
          {task.type === 'video' ? (
            <video src={task.resultUrl} className="w-full h-full object-cover" muted />
          ) : (
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${task.resultUrl})` }} />
          )}
          <button className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none" onClick={(e) => { e.stopPropagation(); showToast('已下载', { type: 'success' }) }}>
            <Download size={12} />
          </button>
        </div>
      )}

      {/* 展开请求/响应数据 */}
      <button className="flex items-center gap-1 text-[10px] text-[#666] hover:text-[#aaa] transition-colors cursor-pointer border-none bg-transparent" onClick={() => setShowData((v) => !v)}>
        <ChevronDown size={11} className={`transition-transform ${showData ? 'rotate-180' : ''}`} /> 请求/响应数据
      </button>
      {showData && (
        <pre className="text-[10px] text-[#777] bg-[#151515] border border-[#242424] rounded-lg p-2 overflow-auto max-h-[140px] whitespace-pre-wrap">
{JSON.stringify({ id: task.id, nodeId: task.nodeId, status: task.status, type: task.type, modelName: task.modelName, channelName: task.channelName, prompt: task.prompt, createdAt: task.createdAt }, null, 2)}
        </pre>
      )}
    </div>
  )
}

function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer border-none text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#ccc] hover:bg-[#2c2c2c] hover:text-white'}`} onClick={onClick}>
      <Icon size={12} /> {label}
    </button>
  )
}
