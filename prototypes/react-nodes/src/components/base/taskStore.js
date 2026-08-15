/**
 * 任务中心 store —— 后端化（对齐官方，数据落 localTool /api/tasks → SQLite）。
 *
 * 职责：
 *  - 内存态 `tasks` 是唯一数据源（供 useTasks / 任务中心 UI 实时订阅）。
 *  - 启动时从 /api/tasks 加载历史任务（刷新/重启不丢）。
 *  - 增删改（reportGenerate / progress / done / fail / removeTask / clearTasksBy）
 *    同步调用后端持久化（fire-and-forget，不阻塞 UI；失败降级为仅内存）。
 *
 * 任务字段（对齐官方 Ln.jsx / jn.jsx）：
 *  { id(=taskId), nodeId, type, prompt, modelName, channelName,
 *    status:'pending'|'running'|'completed'|'failed', progress, errorMsg, resultUrl, createdAt }
 */
import { useSyncExternalStore } from 'react'
import { fetchTasks, saveTask, deleteTask, batchDeleteTasks, clearAllTasksApi } from './tasksApi.js'
import { saveResultToTasks } from './filesApi.js'

let tasks = []
const listeners = new Set()

// ── 启动时从后端加载历史任务 ──
let loaded = false
export function initTasks() {
  if (loaded) return
  loaded = true
  fetchTasks({ pageSize: 500 })
    .then((data) => {
      const items = Array.isArray(data?.items) ? data.items : []
      if (items.length > 0) {
        tasks = items
        notify()
      }
    })
    .catch((e) => console.warn('[taskStore] 加载历史任务失败（localTool 未连？）:', e?.message))
}

// 后端保存（fire-and-forget，失败仅降级为内存态）
function persist(task) {
  saveTask(task).catch(() => {})
}

// 状态 → 圆点/文字 颜色（对齐官方 An）
export function statusDotClass(status) {
  if (status === 'completed') return 'bg-emerald-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-blue-400'
}

// 状态 → 文案（对齐官方 On）
export function statusLabel(status, progress = 0) {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'pending') return '生成中'
  if (status === 'running') return progress > 0 ? `${Math.round(progress)}%` : '生成中'
  return status
}

// 类型 → 文案（对齐官方 Tn 映射 + 补充）
export function typeLabel(type) {
  return {
    text: '文本',
    image: '生图',
    video: '视频',
    sd2Video: 'SD2视频',
    discountVideo: '特惠视频',
    custom: '万能',
    rhWebapp: 'AI应用'
  }[type] || type || '任务'
}

function genId() {
  return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return tasks
}

// 节点生成时上报任务（生成中 → 完成/失败）。返回更新函数。
export function reportGenerate(nodeId, type, prompt, meta = {}) {
  // 结束同 nodeId 之前未完成的任务
  const old = tasks.find((t) => t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending'))
  tasks = tasks.filter((t) => t !== old)
  const task = {
    id: genId(), nodeId, type, prompt,
    modelName: meta.modelName || '', channelName: meta.channelName || '',
    status: 'running', progress: 0, errorMsg: '', resultUrl: '',
    createdAt: Date.now()
  }
  tasks = [task, ...tasks]
  notify()
  persist(task) // 后端持久化
  return {
    // 更新进度
    progress: (p) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: p } : t))
      notify()
      persist({ ...task, status: 'running', progress: p }) // 同步后端进度
    },
    // 标记完成（可带结果缩略图）
    done: (resultUrl) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100, resultUrl: resultUrl || '' } : t))
      notify()
      persist({ ...task, status: 'completed', progress: 100, resultUrl: resultUrl || '' })
      // 生成结果落盘 tasks 目录（对齐官方 Ce.uploadFile），使「生成」面板能收录。
      // 异步执行，失败不影响主流程（节点显示/任务中心仍用原始 url）。
      if (resultUrl && !resultUrl.startsWith('blob:')) {
        saveResultToTasks(resultUrl, task.type).then((persistedUrl) => {
          if (persistedUrl) {
            tasks = tasks.map((t) => (t.id === task.id ? { ...t, resultUrl: persistedUrl } : t))
            notify()
            persist({ ...task, status: 'completed', progress: 100, resultUrl: persistedUrl })
          }
        })
      }
    },
    // 标记失败
    fail: (errorMsg) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'failed', errorMsg: errorMsg || '生成失败' } : t))
      notify()
      persist({ ...task, status: 'failed', errorMsg: errorMsg || '生成失败' })
    }
  }
}

export function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id)
  notify()
  deleteTask(id).catch(() => {}) // 后端删除
}

// ── 「再来一次/刷新」真正触发节点重新生成 ──
const retryRegistry = new Map()

export function registerTaskRetry(nodeId, fn) {
  if (nodeId) retryRegistry.set(nodeId, fn)
}
export function unregisterTaskRetry(nodeId) {
  if (nodeId) retryRegistry.delete(nodeId)
}

/**
 * 重试任务：触发对应节点的重新生成（若节点已注册回调）。
 * 返回是否成功触发（true=已触发，false=找不到节点回调）。
 */
export function retryTask(id) {
  const t = tasks.find((x) => x.id === id)
  const fn = t ? retryRegistry.get(t.nodeId) : undefined
  if (fn) {
    try { fn() } catch (e) { console.error('[taskStore] 触发节点重试失败:', e) }
    return true
  }
  console.warn('[taskStore] 未找到任务对应节点的重试回调 nodeId=', t?.nodeId)
  return false
}

/**
 * 按 nodeId 直接触发节点生成（供 Agent trigger_generation / 测试 / 脚本调用）。
 * 复用 useNodeGeneration 注册到 retryRegistry 的回调（即该节点的 start）。
 * 返回是否成功触发。
 */
export function runNodeGeneration(nodeId) {
  if (!nodeId) return false
  const fn = retryRegistry.get(nodeId)
  if (fn) {
    try { fn() } catch (e) { console.error('[taskStore] runNodeGeneration 触发失败:', e) }
    return true
  }
  console.warn('[taskStore] runNodeGeneration 未找到节点回调 nodeId=', nodeId)
  return false
}

// 清理：按条件批量删除（同步后端）
export function clearTasksBy(predicate) {
  const removed = tasks.filter((t) => predicate(t))
  if (removed.length > 0) {
    tasks = tasks.filter((t) => !predicate(t))
    notify()
    batchDeleteTasks(removed.map((t) => t.id)).catch(() => {})
  }
}
export function clearAllTasks() {
  if (tasks.length > 0) {
    tasks = []
    notify()
    clearAllTasksApi().catch(() => {})
  }
}

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
