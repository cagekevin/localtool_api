import { useCallback, useEffect, useRef } from 'react'
import { detectFileType, isAssetUrl } from './mediaType.js'
import { showToast } from './toastStore.js'

/**
 * 画布素材「拖入 + 粘贴」hook（复刻官方 H_.jsx:10201-10350 onDragOver ki / onDrop Ai + handlePaste）。
 *
 * 【为什么抽成 hook】
 * App.jsx 里的 onDragOver/onDrop/onPaste/createNodeFromFile 是一组内聚的「素材导入」能力，
 * 直接写在画布宿主里会让 App 越来越臃肿。抽出来：
 *  - App.jsx 只调一次 hook、把事件挂到 ReactFlow，画布宿主保持清爽；
 *  - 其它画布宿主（脚本盒编辑器等）要支持拖入/粘贴，复用即可。
 *
 * 【映射规则（对齐官方）】
 *  - image / video / audio 文件 → imageNode（ImageNode 内部按 URL 判断类型展示；官方同此）
 *  - text 文件 / 纯文本 → textNode
 *  - 拖入 URL 文本：图片类 URL → imageNode，否则 → textNode
 * 原型无后端，文件用 FileReader 读 dataURL 写入节点 data（官方走 localTool hi() 上传 /files/）。
 *
 * @param {Object} opts
 * @param {Function} opts.addNode      建节点：addNode(type, pos, data)
 * @param {Function} opts.screenToFlowPosition  屏幕坐标 → 画布坐标
 * @returns {{ onDragOver, onDrop, onPaste }} 挂到 ReactFlow 的事件 + 供 window paste 监听
 */
export function useAssetDropPaste({ addNode, screenToFlowPosition }) {
  // 记录最近一次鼠标位置（视口坐标）：粘贴时优先落在鼠标处，无鼠标则回退到视图中心。
  // paste 事件本身不带 clientX/Y，官方也是用「当前视口位置」建节点；这里用 mousemove 追踪
  // 更贴近用户预期（在哪儿右键/停留就在哪儿粘贴），对齐 H_.jsx 用视口坐标建节点的思路。
  const lastMouse = useRef(null)
  useEffect(() => {
    const track = (e) => {
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // 计算粘贴落点（flow 坐标）：最近鼠标位置优先，回退到视图中心。都经 screenToFlowPosition 换算。
  const pastePos = useCallback(() => {
    if (lastMouse.current) return screenToFlowPosition(lastMouse.current)
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  }, [screenToFlowPosition])

  // 拖入时阻止浏览器默认（打开文件），标记 copy
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // 文件 → 建素材节点（图片/视频/音频→imageNode，文本→textNode）
  const createNodeFromFile = useCallback(
    (file, pos) => {
      const type = detectFileType(file)
      // 文本：读文本 → textNode
      if (type === 'text') {
        const fr = new FileReader()
        fr.onload = () => {
          addNode('textNode', pos, { text: fr.result, label: file.name })
          showToast(`已导入文本「${file.name}」`)
        }
        fr.readAsText(file)
        return
      }
      if (type === 'other' || type === 'empty') return
      // 图片/视频/音频：读 dataURL → imageNode（ImageNode 自动识别类型展示）
      const fr = new FileReader()
      fr.onload = () => {
        addNode('imageNode', pos, { imageUrl: fr.result, label: file.name })
        showToast(`已导入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}「${file.name}」`)
      }
      fr.readAsDataURL(file)
    },
    [addNode]
  )

  // 拖入
  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) {
        // 拖入 URL 文本（非文件）：图片类 URL → imageNode，其它 → textNode
        const text = e.dataTransfer?.getData('text/plain')
        if (text) {
          if (isAssetUrl(text)) {
            addNode('imageNode', pos, { imageUrl: text })
            showToast('已导入图片链接')
          } else {
            addNode('textNode', pos, { text, expanded: false })
            showToast('已导入文本')
          }
        }
        return
      }
      Array.from(files).forEach((f, i) => createNodeFromFile(f, { x: pos.x + i * 50, y: pos.y + i * 50 }))
    },
    [screenToFlowPosition, addNode, createNodeFromFile]
  )

  // 粘贴：文件（图片/视频/音频）→ imageNode；mutiwindow-images → imageNode 网格；纯文本 → textNode
  const onPaste = useCallback(
    (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      // 落点：最近鼠标位置优先，回退到视图中心（flow 坐标）
      const pos = pastePos()
      for (const item of items) {
        if (item.kind === 'file') {
          const type = item.type
          if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) createNodeFromFile(file, pos)
            return
          }
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          e.preventDefault()
          item.getAsString((text) => {
            if (text && text.trim()) {
              // 内部节点 JSON：mutiwindow-nodes 跳过；mutiwindow-images → 建 imageNode 网格（复刻官方 H_.jsx:9790-9828）
              try {
                const parsed = JSON.parse(text)
                if (parsed?.type === 'mutiwindow-nodes') return
                if (parsed?.type === 'mutiwindow-images' && Array.isArray(parsed.images)) {
                  const images = parsed.images
                  if (images.length === 0) return
                  images.forEach((img, i) => {
                    const col = i % 6
                    const row = Math.floor(i / 6)
                    addNode('imageNode', { x: pos.x + col * 150, y: pos.y + row * 150 }, {
                      imageUrl: img,
                      label: `提取帧 ${i + 1}`
                    })
                  })
                  showToast(`已粘贴 ${images.length} 张提取的图片`)
                  return
                }
              } catch {}
              addNode('textNode', pos, { text: text.trim(), expanded: false })
            }
          })
          return
        }
      }
    },
    [createNodeFromFile, addNode, pastePos]
  )

  return { onDragOver, onDrop, onPaste }
}

/**
 * 注册全局粘贴监听（window paste → onPaste）。宿主在组件里调用一次即可。
 * @param {Function} onPaste
 */
export function useGlobalPaste(onPaste) {
  useEffect(() => {
    if (!onPaste) return
    const handler = (e) => onPaste(e)
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onPaste])
}
