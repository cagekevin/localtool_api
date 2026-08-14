/**
 * 项目 store（对齐官方 Vr.jsx 项目系统）。
 *
 * 数据（localStorage）：
 *  - projects：项目列表 [{id, name}]，key = 'projects'，默认含 {id:'default', name:'默认项目'}
 *  - lastOpenedProject：当前项目 id，key = 'lastOpenedProject'，默认 'default'
 *  - canvas-state-v1-${projectId}：每个项目的画布快照 {nodes, edges}
 *
 * 接真系统：改为后端 /api/projects + 项目画布存 IndexedDB，UI 不变。
 */
import { useSyncExternalStore } from 'react'

const PROJECTS_KEY = 'projects'
const LAST_OPENED_KEY = 'lastOpenedProject'
const CANVAS_STATE_PREFIX = 'canvas-state-v1-'

let projects = loadProjects()
let currentProjectId = loadLastOpened()
const listeners = new Set()

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

function loadProjects() {
  const list = loadJSON(PROJECTS_KEY, null)
  if (Array.isArray(list) && list.length > 0) return list
  const seeded = [{ id: 'default', name: '默认项目' }]
  saveJSON(PROJECTS_KEY, seeded)
  return seeded
}

function loadLastOpened() {
  const v = loadJSON(LAST_OPENED_KEY, 'default')
  return typeof v === 'string' && v ? v : 'default'
}

// 缓存快照对象，保证 useSyncExternalStore 的 getSnapshot 返回稳定引用（避免无限重渲染）
let lastSnapshot = { projects, currentProjectId }

function updateSnapshot() {
  lastSnapshot = { projects, currentProjectId }
}

function notify() {
  updateSnapshot()
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return lastSnapshot
}

function genId() {
  return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

// 读写当前项目画布快照
export function loadCanvasState(projectId) {
  return loadJSON(CANVAS_STATE_PREFIX + (projectId || currentProjectId), null)
}
export function saveCanvasState(projectId, nodes, edges) {
  saveJSON(CANVAS_STATE_PREFIX + (projectId || currentProjectId), { nodes, edges })
}

// 当前项目信息
export function getCurrentProject() {
  return projects.find((p) => p.id === currentProjectId) || projects[0] || { id: 'default', name: '默认项目' }
}

// 新建项目：返回新项目；创建后切到该项目（不自动清空画布，由调用方决定）
export function createProject(name) {
  const proj = { id: genId(), name: (name && name.trim()) || '未命名项目' }
  projects = [...projects, proj]
  currentProjectId = proj.id
  saveJSON(PROJECTS_KEY, projects)
  saveJSON(LAST_OPENED_KEY, currentProjectId)
  notify()
  return proj
}

// 切换项目：返回目标项目
export function switchProject(id) {
  if (!projects.some((p) => p.id === id)) return getCurrentProject()
  currentProjectId = id
  saveJSON(LAST_OPENED_KEY, id)
  notify()
  return getCurrentProject()
}

// 删除项目：至少保留一个；删除时移除画布快照，切到第一个
export function deleteProject(id) {
  if (projects.length <= 1) return false
  projects = projects.filter((p) => p.id !== id)
  try {
    localStorage.removeItem(CANVAS_STATE_PREFIX + id)
  } catch { /* ignore */ }
  if (currentProjectId === id) currentProjectId = projects[0].id
  saveJSON(PROJECTS_KEY, projects)
  saveJSON(LAST_OPENED_KEY, currentProjectId)
  notify()
  return true
}

// 重命名项目
export function renameProject(id, name) {
  projects = projects.map((p) => (p.id === id ? { ...p, name: (name && name.trim()) || p.name } : p))
  saveJSON(PROJECTS_KEY, projects)
  notify()
}

export function useProjects() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
