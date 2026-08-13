import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactFlow, useUpdateNodeInternals } from 'reactflow'

/**
 * 判断事件目标是否在可编辑元素内（INPUT / TEXTAREA / contenteditable）。
 * 右键菜单与快捷键都要「在输入框内跳过」，共用此判定（复刻 H_.jsx:1316-1323 Xn）。
 */
export function isEditableTarget(e) {
  const t = e?.target
  if (!t) return false
  const tag = t.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    !!t.isContentEditable ||
    (!!t.closest && !!t.closest('input, textarea, [contenteditable="true"]'))
  )
}

/**
 * 展开/收起控制 hook。
 * 所有带「下方输入面板」的节点共用同一套展开语义：
 *  - 点击主显示框切换
 *  - 面板用 opacity/scale/h-0 过渡
 */
export function useNodeExpanded(initial = true) {
  const [expanded, setExpanded] = useState(initial)
  const toggle = useCallback(() => setExpanded((v) => !v), [])
  return { expanded, setExpanded, toggle }
}

/**
 * 比例 → 节点尺寸同步 hook（复刻 bo.jsx:631-745 / As.jsx:993-1140 尺寸管理）。
 * 解决「改比例时端口/连线跑偏」：比例变化时同步 wrapper 尺寸，
 * 并调用 updateNodeInternals 让 React Flow 重算 handle 位置。
 *
 * 两种尺寸模式：
 *  - mode='width-fixed'（生图节点）：宽度固定，height = 当前宽度 ÷ 比例
 *  - mode='area-fixed'（特惠视频）：面积固定，width = sqrt(ratio)*base，height = base/sqrt(ratio)
 *
 * @param id 节点 id
 * @param aspectRatio 当前比例字符串（'Auto' 或 '16:9'）
 * @param opts { mode, defaultWidth, defaultHeight, baseSize }
 */
export function useSizeSync(id, aspectRatio, opts = {}) {
  const { getNodes, setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const mode = opts.mode || 'width-fixed'
  const defaultWidth = opts.defaultWidth ?? 420
  const defaultHeight = opts.defaultHeight ?? 420
  const baseSize = opts.baseSize ?? 380 // area-fixed 的面积基准
  const ratio = parseAspect(aspectRatio)

  useEffect(() => {
    const n = getNodes().find((x) => x.id === id)
    if (!n) return
    let w, h
    if (ratio) {
      if (mode === 'area-fixed') {
        w = Math.round(Math.sqrt(ratio) * baseSize)
        h = Math.round(baseSize / Math.sqrt(ratio))
      } else {
        // width-fixed：宽度固定为当前宽度（或默认宽）
        w = n.style?.width ?? n.width ?? defaultWidth
        h = Math.round(w / ratio)
      }
    } else {
      // Auto：用默认尺寸
      w = n.style?.width ?? n.width ?? defaultWidth
      h = defaultHeight
    }
    const changed =
      (n.style?.height ?? n.height) !== h || (n.style?.width ?? n.width) !== w
    if (changed) {
      setNodes((ns) =>
        ns.map((x) =>
          x.id === id
            ? { ...x, width: w, height: h, style: { ...x.style, width: w, height: h } }
            : x
        )
      )
      updateNodeInternals(id)
    }
  }, [id, ratio, mode, defaultWidth, defaultHeight, baseSize, getNodes, setNodes, updateNodeInternals])

  return ratio
}

/**
 * 解析 '16:9' / '1:1' / 'Auto' → 宽高比数值或 null。
 */
export function parseAspect(aspectRatio) {
  if (!aspectRatio || aspectRatio === 'Auto') return null
  const m = aspectRatio.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/)
  return m ? parseFloat(m[1]) / parseFloat(m[2]) : null
}

/**
 * 右下角手柄（ResizeFullscreenHandle）的尺寸写回 hook。
 * 统一「手柄拖拽 → 尺寸写回 ReactFlow」这一公共机制，供所有节点复用一个入口：
 *
 *  - onMainBoxResize(w, h)：主框手柄 → 写回 node.width/height + updateNodeInternals，
 *    让 ReactFlow wrapper 跟随（端口基于 wrapper 中点不错位）。
 *  - onInputResize(w, h)：输入框手柄 → 写回 node.data.inputWidth/inputHeight，
 *    输入框尺寸跟随（复刻官方 inputWidth/inputHeight 机制）。
 *
 * @param id 节点 id
 */
export function useNodeResize(id) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const onMainBoxResize = useCallback(
    (w, h) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, width: w, height: h, style: { ...n.style, width: w, height: h } } : n
        )
      )
      updateNodeInternals(id)
    },
    [id, setNodes, updateNodeInternals]
  )

  const onInputResize = useCallback(
    (w, h) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, inputWidth: w, inputHeight: h } } : n))
      )
    },
    [id, setNodes]
  )

  return { onMainBoxResize, onInputResize }
}

/**
 * 生成/停止模拟 hook。
 * @param onDone 生成完成回调（可设结果）
 * @param delay 模拟耗时 ms
 */
export function useGenerate({ onDone, delay = 2000 } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef(null)

  const start = useCallback(() => {
    if (timer.current) return
    setLoading(true)
    setError('')
    timer.current = setTimeout(() => {
      setLoading(false)
      timer.current = null
      onDone?.()
    }, delay)
  }, [onDone, delay])

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setLoading(false)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { loading, setLoading, error, setError, start, stop }
}
