/**
 * 节点「上次参数」记忆（跨节点 / 跨会话）。
 *
 * 目的：新建节点时默认用「上次选择」的参数（模型/比例/尺寸/张数等），
 * 复刻 1mao「记住上次选择」的体验，减少重复设置。
 *
 * 用法（各节点通用）：
 *   const prefs = useNodePrefs('textNode', { model: 'lovart-chat' })  // 读上次 + 注入默认
 *   prefs.set({ model })                                              // 保存本次选择
 *   onChange={(model) => { setSelectedModel(model); prefs.set({ model }) }}
 *
 * 存储：localStorage 键 `yimao_node_prefs`，结构 { [nodeType]: { ...lastParams } }。
 * 接真系统：可改为后端 KV（app_settings / node_prefs），本模块是纯前端唯一数据源。
 */
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'yimao_node_prefs'

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 读取某节点类型的上次参数（合并默认值）。
 * @param {string} type 节点类型，如 'textNode' / 'promptNode' / 'discountVideoNode'
 * @param {object} defaults 默认参数
 * @returns {{ prefs: object, set: (patch: object) => void }}
 */
export function useNodePrefs(type, defaults = {}) {
  const [prefs, setPrefs] = useState(() => {
    const all = loadAll()
    return { ...defaults, ...(all[type] || {}) }
  })

  const set = useCallback(
    (patch) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        // 持久化
        try {
          const all = loadAll()
          all[type] = next
          localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
        } catch { /* ignore */ }
        return next
      })
    },
    [type]
  )

  return { prefs, set }
}
