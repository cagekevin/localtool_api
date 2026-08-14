/**
 * 任务中心 store（模拟 + 事件订阅），字段对齐官方任务中心（Ln.jsx / jn.jsx）。
 *
 * 任务字段：
 *  {
 *    id, nodeId,
 *    status: 'pending' | 'running' | 'completed' | 'failed',   // 对齐官方
 *    type: 'image' | 'video' | 'text',                          // 对齐官方类型
 *    prompt, modelName, channelName,
 *    progress: 0-100,             // 运行中进度（官方进度条）
 *    errorMsg,                    // 失败错误信息
 *    resultUrl,                   // 结果缩略图（图片/视频）
 *    createdAt
 *  }
 *
 * 接真系统：reportGenerate 改为 POST /api/tasks，列表从 /api/tasks 读，UI 不变。
 */
import { useSyncExternalStore } from 'react'

let tasks = seedTasks()
const listeners = new Set()

// 预置演示任务（首次即有内容可看）
function seedTasks() {
  const now = Date.now()
  const at = (minAgo) => now - minAgo * 60 * 1000
  return [
    {
      id: 'seed_1', nodeId: 'seed-node-1', type: 'image', status: 'completed',
      prompt: '赛博朋克城市夜景，霓虹灯，雨夜，电影感光影',
      modelName: 'flux-1.1-pro', channelName: '在线', progress: 100,
      resultUrl: 'https://picsum.photos/seed/cyber/240/240', createdAt: at(2)
    },
    {
      id: 'seed_2', nodeId: 'seed-node-2', type: 'video', status: 'failed',
      prompt: '一只小猫在花园里追逐蝴蝶，阳光，微风吹动花朵',
      modelName: 'kling-1.6', channelName: '在线', progress: 100,
      errorMsg: '模型接口超时，请稍后重试', createdAt: at(5)
    },
    {
      id: 'seed_3', nodeId: 'seed-node-3', type: 'text', status: 'completed',
      prompt: '写一段关于春天的散文，清新自然，多用比喻',
      modelName: 'gpt-4o-mini', channelName: '在线', progress: 100,
      createdAt: at(8)
    },
    {
      id: 'seed_4', nodeId: 'seed-node-4', type: 'image', status: 'running',
      prompt: '莫奈风格的睡莲，印象派，柔和光线', modelName: 'flux-1.1-pro',
      channelName: '在线', progress: 42, createdAt: at(12)
    },
    {
      id: 'seed_5', nodeId: 'seed-node-5', type: 'video', status: 'pending',
      prompt: '波普艺术风格人像', modelName: 'kling-1.6', channelName: '在线',
      progress: 0, createdAt: at(15)
    }
  ]
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
  tasks = tasks.filter((t) => !(t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending')))
  const task = {
    id: genId(), nodeId, type, prompt,
    modelName: meta.modelName || '', channelName: meta.channelName || '',
    status: 'running', progress: 0, errorMsg: '', resultUrl: '',
    createdAt: Date.now()
  }
  tasks = [task, ...tasks]
  notify()
  return {
    // 更新进度
    progress: (p) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: p } : t))
      notify()
    },
    // 标记完成（可带结果缩略图）
    done: (resultUrl) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100, resultUrl: resultUrl || '' } : t))
      notify()
    },
    // 标记失败
    fail: (errorMsg) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'failed', errorMsg: errorMsg || '生成失败' } : t))
      notify()
    }
  }
}

export function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id)
  notify()
}

export function retryTask(id) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: 'running', progress: 0, errorMsg: '' } : t))
  notify()
}

// 清理：按条件批量删除
export function clearTasksBy(predicate) {
  tasks = tasks.filter((t) => !predicate(t))
  notify()
}
export const clearAllTasks = () => clearTasksBy(() => true)

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
