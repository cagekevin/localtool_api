import { useEffect, useCallback } from 'react'

/**
 * 全局键盘快捷键 hook（复刻 H_.jsx:11427-11586 的 keydown/paste 监听）。
 *
 * 守卫条件与源码一致：
 *  - 输入框 / 可编辑元素内按键 → 跳过（复刻 Xn/e()）
 *  - 有文本选中且触发纯文本类快捷键 → 跳过（复刻 n()/t()）
 *
 * @param handlers
 *  - onUndo / onRedo          Ctrl+Z / Ctrl+Shift+Z 或 Ctrl+Y
 *  - onSelectAll              Ctrl+A
 *  - onDuplicate              Ctrl+D
 *  - onAdd(type)              Q / W / E 快速添加文本/图片/视频
 *  - getPosition()            快速添加节点时的坐标（默认基于当前鼠标不可得时返回 0,0）
 */
export function useCanvasShortcuts(handlers = {}) {
  const { onUndo, onRedo, onSelectAll, onDuplicate, onAdd } = handlers

  // 输入框内跳过（复刻 H_.jsx:1316-1323 Xn）
  const isEditableTarget = useCallback((e) => {
    const t = e.target
    if (!t) return false
    const tag = t.tagName
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      !!t.isContentEditable ||
      (!!t.closest && !!t.closest('input, textarea, [contenteditable="true"]'))
    )
  }, [])

  // 有选中文本（复刻 H_.jsx:11427-11434 n）
  const hasSelectionText = useCallback(() => {
    try {
      const sel = window.getSelection()
      return !!sel && sel.toString().length > 0
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      // 输入框内一律跳过
      if (isEditableTarget(e)) return

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // 无修饰键快速添加：Q / W / E
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (key === 'q') { e.preventDefault(); onAdd?.('textNode'); return }
        if (key === 'w') { e.preventDefault(); onAdd?.('promptNode'); return }
        if (key === 'e') { e.preventDefault(); onAdd?.('discountVideoNode'); return }
      }

      if (!mod) return
      if (e.shiftKey && key === 'z') {
        e.preventDefault()
        onRedo?.()
        return
      }
      if (key === 'z') { e.preventDefault(); onUndo?.(); return }
      if (key === 'y') { e.preventDefault(); onRedo?.(); return }

      // 选中文本时跳过（复刻 H_.jsx:11493-11517）
      if (hasSelectionText()) return

      if (key === 'a') { e.preventDefault(); onSelectAll?.() }
      else if (key === 'd') { e.preventDefault(); onDuplicate?.() }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditableTarget, hasSelectionText, onUndo, onRedo, onSelectAll, onDuplicate, onAdd])
}
