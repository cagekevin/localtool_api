import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react'
import { Type, Image as ImageIcon, Clapperboard, Trash2, Copy, Zap } from 'lucide-react'
import CanvasToolbar from './components/base/CanvasToolbar.jsx'
import ArrangeConfirm from './components/base/ArrangeConfirm.jsx'
import { useArrangeCanvas } from './components/base/useArrangeCanvas.js'
import { useAssetDropPaste, useGlobalPaste } from './components/base/useAssetDropPaste.js'
import TextNode from './components/TextNode.jsx'
import ImageNode from './components/ImageNode.jsx'
import PromptNode from './components/PromptNode.jsx'
import DiscountVideoNode from './components/DiscountVideoNode.jsx'
import GroupNode from './components/GroupNode.jsx'
import ScriptBoxNode from './components/ScriptBoxNode.jsx'
import GhostTargetNode from './components/GhostTargetNode.jsx'
import CustomEdge from './components/CustomEdge.jsx'
import ConnectionLine from './components/ConnectionLine.jsx'
import ContextMenu from './components/base/ContextMenu.jsx'
import { useContextMenu } from './components/base/useContextMenu.js'
import { useCanvasHistory } from './components/base/useCanvasHistory.js'
import { useCanvasShortcuts } from './components/base/useCanvasShortcuts.js'
import { paletteCategories, getNodesByCategory, defaultNodeData } from './components/base/NodePalette.jsx'
import LodProvider from './components/base/LodProvider.jsx'
import LodListener from './components/base/LodListener.jsx'
import ToastContainer from './components/base/ToastContainer.jsx'
import { showToast } from './components/base/toastStore.js'

/* ======================================================================
 * 【区 1】常量与配置区
 * nodeTypes / edgeTypes / 初始画布内容 / 画布参数
 * ====================================================================== */

// 节点类型注册表：新增节点时在此登记 type → 组件
const nodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  promptNode: PromptNode,
  discountVideoNode: DiscountVideoNode,
  group: GroupNode,
  scriptBoxNode: ScriptBoxNode,
  ghostTarget: GhostTargetNode
}

// 边类型注册表
const edgeTypes = {
  default: CustomEdge
}

// 初始画布节点（演示用）
const initialNodes = [
  {
    id: 'text-1',
    type: 'textNode',
    position: { x: 100, y: 60 },
    data: {
      label: '文本节点',
      text: '双击这里可编辑文本内容，或点击下方生成按钮。',
      prompt: '写一段关于春天的散文',
      selectedModel: 'gpt-4o-mini'
    }
  },
  {
    id: 'prompt-1',
    type: 'promptNode',
    position: { x: 680, y: 60 },
    data: {
      label: '生图节点',
      prompt: '赛博朋克风格的城市夜景',
      selectedModel: 'gpt-image-1',
      aspectRatio: 'Auto',
      imageSize: '1K',
      quality: 'auto',
      apiFormat: 'auto',
      count: 1,
      expanded: true
    },
    // 复刻 bo.jsx:631 生图节点默认 420×420（width+height 同设，避免端口跑偏）
    width: 420,
    height: 420,
    style: { width: 420, height: 420 }
  },
  {
    id: 'discount-1',
    type: 'discountVideoNode',
    position: { x: 680, y: 640 },
    data: {
      label: '特惠视频',
      prompt: '一只小猫在花园里追逐蝴蝶',
      selectedModel: 'runway-gen3',
      size: '16:9',
      resolution: '1080p',
      selectedSeconds: '10'
    }
  },
  {
    id: 'image-1',
    type: 'imageNode',
    position: { x: 760, y: 240 },
    data: {
      label: '图片节点',
      demoImage: true,
      imageUrl: 'https://picsum.photos/seed/imagedemo/420/300',
      thumbnailUrl: 'https://picsum.photos/seed/imagedemo/420/300'
    },
    style: { width: 260, height: 200 }
  },
  {
    id: 'script-1',
    type: 'scriptBoxNode',
    position: { x: 700, y: 1000 },
    width: 900,
    height: 640,
    style: { width: 900, height: 640 },
    data: {
      label: '剧本盒子',
      step: 1,
      story: '小马想要找到一片更好的草地，老牛和松鼠决定陪它一起出发。',
      // 统一风格字段名遵循职责铁律：globalStyle（不是 style）
      globalStyle: '电影感',
      styleChips: ['电影感', '水墨风', '皮克斯3D', '赛博朋克'],
      shotCount: 'auto',
      customCount: '',
      shots: [],
      assets: [],
      // 配置字段（设置弹窗读写）
      aspectRatio: '16:9',
      customAspectRatio: '',
      imageGlobalConstraint: '',
      videoGlobalConstraint: '',
      customGlobalConstraint: '',
      customScriptPrompt: '',
      customShotPrompt: '',
      // 资产参考图模板必须是对象 {character, scene, prop}（不是数组）
      customAssetTemplates: { character: '', scene: '', prop: '' },
      // 资产生图模型设置
      assetModelSettings: { globalModel: 'gpt-image-2-low', globalAspectRatio: '16:9', globalSize: '1K' },
      // 全局约束数组（Ir 引擎读取）
      globalConstraints: [],
      // 模型（官方注入字段）
      selectedModel: 'gpt-4o-mini',
      textModel: 'gpt-4o-mini',
      drawingModelForScript: 'gpt-image-2-low',
      // 视频上传状态
      videoUploadedAssets: {},
      videoAssetUploadStatus: {},
      videoAssetUploadErrors: {},
      // 生成遮罩计时
      genMask: false,
      genSecs: 0
    }
  }
]

// 初始连线（演示用）
const initialEdges = [
  {
    id: 'edge-text-image',
    source: 'text-1',
    target: 'image-1',
    type: 'default',
    animated: false
  },
  {
    id: 'edge-image-prompt',
    source: 'image-1',
    target: 'prompt-1',
    type: 'default',
    animated: false
  }
]

function Canvas() {
  /* ====================================================================
   * 【区 2】状态区
   * nodes / edges + ref 同步（供能力区取最新快照，避免闭包旧值）
   * ==================================================================== */
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 视窗中心 → flow 坐标（Q/W/E 快速添加节点用）；缩放/适配用 fitView/zoomIn/zoomOut
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()

  // 小地图开关（复刻 H_.jsx:474 un/dn，默认开）。仅当节点数 <100 时显示 MiniMap（官方 De.length<100）。
  // 接真系统：改为读项目设置持久化（localTool KV / app_settings）即可，本 state 是唯一数据源。
  const [minimapOn, setMinimapOn] = React.useState(true)

  // 缩放性能模式开关（复刻 H_.jsx:79 ge，官方默认 true：性能模式默认开启）。
  // 抉择：默认开对齐官方，让缩小视图时天然触发 LOD 降级（节点隐藏图片/视频）。
  // 接真系统：官方此值从 app_settings 读入（Vr.jsx ei），改为持久化即可。
  const [performanceMode, setPerformanceMode] = React.useState(true)

  // 整理后「是否保留」快照（复刻 H_.jsx:134 tt/nt，null = 无弹窗）。
  // 存「排列前」的 nodes/edges 快照，「还原」= 整体写回（见 revertArrange）。
  const [arrangeSnapshot, setArrangeSnapshot] = React.useState(null)

  // 自动排版（复刻 H_.jsx:10985 Ui / Ctrl+L）。本 hook 只做纯布局计算，快照/历史/确认弹窗由
  // arrangeCanvas 在此统一编排（见能力区）。
  const { arrange } = useArrangeCanvas()

  // 当前缩放百分比（监听 viewport 变化，驱动左下角 zoom% 显示）。
  // 接真系统：若需在缩小到某级做额外事（如隐藏 toolbar 部分按钮），可直接读 lodLevel state（见下）。
  const [zoomPercent, setZoomPercent] = React.useState(100)
  const onViewportChange = React.useCallback((v) => {
    setZoomPercent(Math.round((v?.zoom || 1) * 100))
  }, [])

  // 始终指向最新 nodes/edges（撤销/重做取快照用）
  const nodesRef = React.useRef(nodes)
  const edgesRef = React.useRef(edges)
  React.useEffect(() => { nodesRef.current = nodes }, [nodes])
  React.useEffect(() => { edgesRef.current = edges }, [edges])

  // 历史栈（基座 useCanvasHistory）：record 需显式传最新快照，避免异步 setState 取到旧值
  const history = useCanvasHistory(
    () => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    ({ nodes: ns, edges: es }) => {
      setNodes(ns)
      setEdges(es)
    }
  )

  // 右键菜单状态（基座 useContextMenu）
  const menu = useContextMenu()

  // LOD 视口缩放等级（基座 LodListener/LodProvider）
  const [lodLevel, setLodLevel] = React.useState(0)

  /* ====================================================================
   * 【区 3】能力区
   * 画布操作：addNode / deleteNode / selectAll / duplicateSelected
   * ==================================================================== */

  // 新增节点（复刻源码 di(type, position, data, connection)）
  // connection?: { source, sourceHandle, dropPosition } —— 从端口拖出到空白时，
  // 在 dropPosition 建节点并自动创建 source→新节点 的边；scriptBox 的 shot- 端口预填宽高比/时长。
  const addNode = useCallback(
    (type, position, data = {}, connection) => {
      const id = `${type}-${Date.now()}`
      const nodeData = { label: '', ...data }

      // scriptBoxNode 的 shot- 端口 → promptNode/discountVideoNode 时预填（复刻 di:8667-8687）
      if (connection) {
        const src = nodesRef.current.find((n) => n.id === connection.source)
        const shotId = connection.sourceHandle?.startsWith('shot-') ? connection.sourceHandle.slice(5) : null
        const shot = shotId && src?.type === 'scriptBoxNode' ? (src.data?.shots || []).find((s) => s.id === shotId) : null
        if (shot) {
          const ar = String(src.data?.aspectRatio || '16:9')
          const o = ar === 'custom' ? String(src.data?.customAspectRatio || '16:9') : ar
          if (type === 'promptNode') {
            nodeData.aspectRatio = o === '4:4' ? '1:1' : o
          } else if (type === 'discountVideoNode') {
            nodeData.size = o === '4:4' ? '1:1' : o
            nodeData.selectedSeconds = String(Math.max(1, Number.parseInt(shot.duration || '5', 10) || 5))
            nodeData.durationFromScript = true
          }
        }
      }

      const newNode = { id, type, position: { ...position }, data: nodeData }
      if (type === 'promptNode') {
        // 生图节点默认 420×420，避免端口跑偏
        Object.assign(newNode, { width: 420, height: 420, style: { width: 420, height: 420 } })
      }
      const nextNodes = [...nodesRef.current, newNode]
      // 若带 connection：自动创建 source→新节点 的边
      const nextEdges = connection
        ? [...edgesRef.current, { id: `e-${connection.source}-${id}`, source: connection.source, sourceHandle: connection.sourceHandle || null, target: id, type: 'default', animated: false }]
        : edgesRef.current
      setNodes(nextNodes)
      if (connection) setEdges(nextEdges)
      history.record({ nodes: nextNodes, edges: nextEdges })
      return id
    },
    [setNodes, setEdges, history]
  )

  // 删除节点及其相连边
  const deleteNode = useCallback(
    (id) => {
      const nextNodes = nodesRef.current.filter((n) => n.id !== id)
      const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      history.record({ nodes: nextNodes, edges: nextEdges })
    },
    [setNodes, setEdges, history]
  )

  // 全选（复刻 H_.jsx:11493-11513）
  const selectAll = useCallback(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })))
  }, [setNodes, setEdges])

  // 克隆当前选中的节点（复刻 Ctrl+D，简化：只克隆节点，偏移 40px）
  const duplicateSelected = useCallback(() => {
    const selected = nodesRef.current.filter((n) => n.selected)
    if (selected.length === 0) return
    const clones = selected.map((n) => ({
      ...n,
      id: `${n.type}-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: { x: (n.position?.x || 0) + 40, y: (n.position?.y || 0) + 40 },
      selected: true
    }))
    const nextNodes = [...nodesRef.current, ...clones]
    setNodes(nextNodes)
    history.record({ nodes: nextNodes, edges: edgesRef.current })
  }, [setNodes, history])

  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）：
  // 先存排列前快照 → dagre 布局写回 → 弹「是否保留整理结果」确认。
  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）。
  // 编排顺序（抉择）：
  //   1. 先存「排列前快照」before → 供「还原」用（不污染全局撤销栈，见 ArrangeConfirm 注释）；
  //   2. 调 useArrangeCanvas.arrange 算新布局并写回（onArrange 走 setNodes/setEdges）；
  //   3. 写回后 fitView 适配新布局；
  //   4. 弹「是否保留」确认窗（ArrangeConfirm）；
  //   5. 把「排列后结果」入历史栈（undo 可回到排列前）。
  // 接真系统：nodesRef.current/edgesRef.current 换 useReactFlow().getNodes/getEdges() 即可，
  // 其余编排不变。
  const arrangeCanvas = useCallback(() => {
    const before = { nodes: nodesRef.current, edges: edgesRef.current }
    const result = arrange({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      onArrange: ({ nodes: ns, edges: es }) => {
        setNodes(ns)
        setEdges(es)
      },
      onComplete: () => {
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 800, maxZoom: 1 })
        }, 100)
      },
    })
    // 弹确认：存排列前快照，还原时写回
    setArrangeSnapshot(before)
    history.record({ nodes: result.nodes, edges: result.edges })
  }, [arrange, setNodes, setEdges, fitView, history])

  // 还原整理：写回排列前快照 + 关闭弹窗 + fitView（复刻 H_.jsx:11996-12006）
  // 抉择：直接用快照整体 setNodes/setEdges，比逆向 dagre 更简单可靠。
  const revertArrange = useCallback(() => {
    if (!arrangeSnapshot) return
    setNodes(arrangeSnapshot.nodes)
    setEdges(arrangeSnapshot.edges)
    setArrangeSnapshot(null)
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800, maxZoom: 1 })
    }, 100)
  }, [arrangeSnapshot, setNodes, setEdges, fitView])

  // 保留整理：仅关闭弹窗（复刻 H_.jsx:12008-12010），整理结果已写回、无需再动
  const keepArrange = useCallback(() => {
    setArrangeSnapshot(null)
  }, [])

  // 缩放控制（复刻 H_.jsx:12051-12067）。zoomIn/zoomOut 是 @xyflow 内置方法，带 300ms 平滑。
  const zoomInStep = useCallback(() => zoomIn({ duration: 300 }), [zoomIn])
  const zoomOutStep = useCallback(() => zoomOut({ duration: 300 }), [zoomOut])

  /* ====================================================================
   * 素材拖入 / 粘贴（复刻 H_.jsx:10201-10350 onDragOver ki / onDrop Ai + handlePaste）
   * 统一收敛到 useAssetDropPaste hook：App 只挂事件，具体建节点逻辑在 hook 里。
   * ==================================================================== */
  const { onDragOver, onDrop, onPaste } = useAssetDropPaste({
    addNode: (type, pos, data) => addNode(type, pos, data),
    screenToFlowPosition
  })
  // 全局粘贴监听（文档级）
  useGlobalPaste(onPaste)

  /* ====================================================================
   * 【区 4】菜单配置区
   * canvas（空白）/ node（单选节点）/ selection（多选）三套右键菜单项
   * ==================================================================== */

  // 空白处菜单：快速添加节点 + 小工具子菜单（复刻 H_.jsx:12232-12340）
  const canvasMenuItems = (state) => {
    // 小工具子菜单：按分类列出目录节点（复刻 H_.jsx:12290-12340 的 at/vi/_i）
    const toolsSubmenu = paletteCategories
      .map((cat) => {
        const catNodes = getNodesByCategory(cat.key)
        if (catNodes.length === 0) return null
        return {
          key: `tools-${cat.key}`,
          label: cat.label,
          items: catNodes.map((n) => ({
            key: n.type,
            icon: n.icon,
            label: n.label,
            badge: n.badge,
            onClick: () => addNodeFromMenu(n.type)
          }))
        }
      })
      .filter(Boolean)

    return [
      { key: 'text', icon: <Type size={16} className="text-green-500" />, label: '文本', shortcut: 'Q', onClick: () => addNodeFromMenu('textNode') },
      { key: 'image', icon: <ImageIcon size={16} className="text-blue-400" />, label: '图片', shortcut: 'W', onClick: () => addNodeFromMenu('promptNode') },
      { key: 'video', icon: <Clapperboard size={16} className="text-yellow-500" />, label: '视频', shortcut: 'E', onClick: () => addNodeFromMenu('discountVideoNode') },
      { type: 'divider' },
      ...toolsSubmenu
    ]
  }

  // 单选节点菜单：复制 / 删除（复刻 H_.jsx:12573-12617）
  const nodeMenuItems = (state) => {
    const node = nodesRef.current.find((n) => n.id === state.nodeId)
    if (!node) return []
    return [
      { key: 'duplicate', icon: <Copy size={16} className="text-gray-300" />, label: '复制节点', onClick: () => addNode(node.type, { x: (node.position?.x || 0) + 40, y: (node.position?.y || 0) + 40 }, node.data || {}) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={16} className="text-red-400" />, label: '删除', danger: true, onClick: () => deleteNode(node.id) }
    ]
  }

  // 从「连接」状态建下游节点：在 dropPosition 建节点 + 自动连线，并清掉 ghost（复刻官方 di + a()）
  const buildFromConnection = useCallback(
    (type, conn) => {
      if (!conn) return
      addNode(type, { x: conn.dropPosition.x, y: conn.dropPosition.y }, defaultNodeData(type), conn)
      setNodes((ns) => ns.filter((n) => n.id !== 'ghost-target'))
      setEdges((es) => es.filter((e) => e.id !== 'ghost-edge'))
      menu.close()
    },
    [addNode, setNodes, setEdges, menu.close]
  )

  // 统一建节点入口（单一数据源）：
  //   - 从端口拖出到空白（state.connection 存在）→ 复用同一份 canvas 菜单项，但建节点时自动连线 + 清 ghost；
  //   - 空白处右键（无 connection）→ 普通建节点。
  const addNodeFromMenu = useCallback(
    (type) => {
      const conn = menu.state?.connection
      if (conn) {
        buildFromConnection(type, conn)
        return
      }
      const s = menu.state || { x: 0, y: 0 }
      addNode(type, { x: s.x, y: s.y }, defaultNodeData(type))
    },
    [menu.state, buildFromConnection, addNode]
  )

  // 多选菜单：删除
  const selectionMenuItems = () => [
    {
      key: 'delete',
      icon: <Trash2 size={16} className="text-red-400" />,
      label: '删除',
      danger: true,
      onClick: () => {
        const sel = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
        const nextNodes = nodesRef.current.filter((n) => !sel.includes(n.id))
        const nextEdges = edgesRef.current.filter((e) => !sel.includes(e.source) && !sel.includes(e.target))
        setNodes(nextNodes)
        setEdges(nextEdges)
        history.record({ nodes: nextNodes, edges: nextEdges })
      }
    }
  ]

  // 根据菜单类型分发到对应配置（单一数据源：拖线复用 canvas 菜单，故无独立 connection 分支）
  const menuItems = (state) => {
    if (state.type === 'node') return nodeMenuItems(state)
    if (state.type === 'selection') return selectionMenuItems(state)
    return canvasMenuItems(state)
  }

  /* ====================================================================
   * 【区 5】事件绑定区
   * 快捷键 / 连线 / 删边监听 / 选中节点→边关联联动
   * ==================================================================== */

  // 键盘快捷键（基座 useCanvasShortcuts）
  useCanvasShortcuts({
    onUndo: history.undo,
    onRedo: history.redo,
    onSelectAll: selectAll,
    onDuplicate: duplicateSelected,
    onArrange: arrangeCanvas,
    onAdd: (type) => {
      // 若处于「拖线」菜单态（复用 canvas 菜单但 state 带 connection）：建下游并自动连线
      const conn = menu.state?.connection
      if (conn) {
        buildFromConnection(type, conn)
        return
      }
      // 否则快速添加节点到视窗中心（复刻 Q/W/E）
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      addNode(type, center, defaultNodeData(type))
    }
  })

  // 连线：连到真实节点时建边（isValid 连接）
  const onConnect = useCallback(
    (params) => {
      const nextEdges = [...edgesRef.current, { ...params, type: 'default', animated: false }]
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    },
    [setEdges, history]
  )

  // 从端口拖出到空白：建 ghost-target + ghost-edge + 弹「连接」菜单（复刻官方 onConnectEnd Oi:H_.jsx:10143）
  // ReactFlow 的 onConnectEnd 第二参数是 connectionState（含 isValid/fromNode/fromHandle）。
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      const t = connectionState || {}
      // 仅当「连接无效（拖到空白）+ 有源节点和源端口」时弹菜单（官方判断）
      if (t.isValid || !t.fromNode || !t.fromHandle) return
      const { clientX, clientY } = event?.changedTouches?.[0] || event || {}
      if (clientX == null) return

      const rect = menu.containerRef.current?.getBoundingClientRect()
      const pos = screenToFlowPosition({ x: clientX, y: clientY })
      // 建 ghost-target（不可见占位节点）
      setNodes((ns) =>
        ns
          .filter((n) => n.id !== 'ghost-target')
          .concat({
            id: 'ghost-target',
            type: 'ghostTarget',
            position: pos,
            style: { opacity: 0, pointerEvents: 'none', width: 1, height: 1 },
            data: { label: '' },
            selectable: false,
            draggable: false
          })
      )
      // 建 ghost-edge（fromNode → ghost-target）
      setEdges((es) =>
        es
          .filter((e) => e.id !== 'ghost-edge')
          .concat({
            id: 'ghost-edge',
            source: t.fromNode.id,
            sourceHandle: t.fromHandle.id || null,
            target: 'ghost-target',
            type: 'default'
          })
      )
      // 弹「连接」菜单（官方 setTimeout 50ms，确保 ghost 渲染完成）
      setTimeout(() => {
        menu.openConnection(
          { source: t.fromNode.id, sourceHandle: t.fromHandle.id || null, dropPosition: pos },
          (clientX - (rect?.left || 0)),
          (clientY - (rect?.top || 0))
        )
      }, 50)
    },
    [setNodes, setEdges, screenToFlowPosition, menu.openConnection]
  )

  // 删除连线（统一入口：CustomEdge 的 ✕ 按钮、连线双击删除 都走这里）
  const removeEdge = useCallback(
    (id) => {
      if (!id) return
      const nextEdges = edgesRef.current.filter((ed) => ed.id !== id)
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    },
    [setEdges, history]
  )

  // CustomEdge 的 ✕ 按钮通过 window 事件触发（edge 组件无法直接拿 App 函数）
  useEffect(() => {
    const handler = (e) => {
      removeEdge(e.detail?.id)
    }
    window.addEventListener('yimao:remove-edge', handler)
    return () => window.removeEventListener('yimao:remove-edge', handler)
  }, [removeEdge])

  // 双击连线删除
  const onEdgeDoubleClick = useCallback(
    (event, edge) => {
      removeEdge(edge.id)
    },
    [removeEdge]
  )

  // deleteElements（CustomEdge 的 ✕ 按钮用）删除连线后，记录 undo 历史
  const onEdgesDelete = useCallback(
    (deleted) => {
      if (!deleted || !deleted.length) return
      const nextEdges = edgesRef.current.filter((ed) => !deleted.some((d) => d.id === ed.id))
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    },
    [history]
  )

  // 选中节点联动：与选中节点相连的边 → data.relatedToSelected = true（触发 comet + 加亮）
  // 每次节点 change 后，基于当前全部选中节点重算每条边的关联态（支持多选）
  const onNodesChangeForEdges = useCallback(
    (changes) => {
      onNodesChange(changes)

      // 聚合本次 change 造成的选中变化（select 类型 change 带 selected 字段）
      const selectionMap = {}
      changes.forEach((c) => {
        if (c.type === 'select' && c.id) {
          selectionMap[c.id] = c.selected
        }
      })
      if (Object.keys(selectionMap).length === 0) return

      // 基于当前 nodes 快照 + 本次 select 覆盖，算出真实选中集合，再重算每条边关联态
      setNodes((currentNodes) => {
        const selectedIds = new Set()
        currentNodes.forEach((n) => {
          const override = selectionMap[n.id]
          if (override !== undefined ? override : !!n.selected) {
            selectedIds.add(n.id)
          }
        })

        setEdges((eds) => {
          let changed = false
          const next = eds.map((ed) => {
            const rel = selectedIds.has(ed.source) || selectedIds.has(ed.target)
            if (ed.data?.relatedToSelected !== rel) {
              changed = true
              return { ...ed, data: { ...ed.data, relatedToSelected: rel } }
            }
            return ed
          })
          return changed ? next : eds
        })
        return currentNodes
      })
    },
    [onNodesChange, setEdges, setNodes]
  )

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  /* ====================================================================
   * 【区 6】渲染区
   * ReactFlow 画布 + 覆盖层（右键菜单）
   * ==================================================================== */
  return (
    <LodProvider value={{ lodLevel, viewportMoving: false, nodeCount: nodes.length, handleFollowLimit: 60, edgeFxLimit: 50 }}>
      <div ref={menu.containerRef} className="relative" style={{ width: '100%', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeForEdges}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineComponent={ConnectionLine}
          connectionRadius={60}
          deleteKeyCode={['Backspace', 'Delete']}
          onPaneContextMenu={menu.onPaneContextMenu}
          onNodeContextMenu={menu.onNodeContextMenu}
          onSelectionContextMenu={menu.onSelectionContextMenu}
          onSelectionEnd={menu.onSelectionEnd}
          onPaneClick={menu.onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          proOptions={proOptions}
          minZoom={0.05}
          maxZoom={4}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
          onViewportChange={onViewportChange}
        >
          {/* 点阵网格：gap=20 / size=1 / color=#333（复刻 H_.jsx:12100） */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#333"
            bgColor="#0d0c0c"
          />
          {/* 小地图（复刻 H_.jsx:12095-12098，仅当开启且节点数 <100 时显示） */}
          {/* 抉择：定位在左下角工具栏上方（bottom-16），样式令牌 #222/#333/nodeColor#444 对齐 docs/39 */}
          {minimapOn && nodes.length < 100 && (
            <div className="absolute left-4 bottom-16 z-[990] flex flex-col items-start gap-2 pointer-events-none">
              <MiniMap
                pannable
                zoomable
                maskColor="#0d0c0c80"
                nodeColor="#444"
                className="!bg-[#222] !m-0 !relative !bottom-0 !left-0 shadow-2xl rounded overflow-hidden border border-[#333] pointer-events-auto"
              />
            </div>
          )}
          {/* 性能模式横幅（复刻 H_.jsx:11966-11971：ge 开 且 lodLevel>=2 时顶部黄条） */}
          {/* lodLevel 由下方 LodListener 计算（缩放越小 level 越高）：>=2 缩到 ≤0.3，>=3 缩到 ≤0.2 */}
          {performanceMode && lodLevel >= 2 && (
            <Panel position="top-center" className="mt-4 pointer-events-none">
              <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-2 animate-pulse">
                <Zap size={14} className="text-yellow-400" />
                {lodLevel === 3 ? '已进入全局性能模式 (图片视频已隐藏)' : '低缩放性能模式 (图片已隐藏)'}
              </div>
            </Panel>
          )}
          {/* LOD 视口缩放监听（基座 LodListener）。
              enablePerformanceMode=false 时 LodListener 会清空 lod class 并把 lodLevel 置 0，
              因此「性能模式关 → 节点不隐藏媒体、横幅不弹」天然成立（各节点用 useLod 读 lodLevel）。 */}
          <LodListener onLodChange={setLodLevel} enablePerformanceMode={performanceMode} />
        </ReactFlow>

        {/* 左下角工具栏（复刻 H_.jsx:12013 bottom-left） */}
        {/* 抉择：工具栏 + 确认弹窗叠在一个 absolute 容器（left-3 bottom-3），弹窗 absolute bottom-full 挂在工具栏上方 */}
        <div className="absolute left-3 bottom-3 z-[900] pointer-events-auto">
          <div className="relative">
            {/* 整理后「是否保留」确认弹窗（复刻 H_.jsx:11993） */}
            <ArrangeConfirm
              snapshot={arrangeSnapshot}
              onRevert={revertArrange}
              onKeep={keepArrange}
            />
            {/* 占位按钮 onRun/onClearCache 未传：接真系统时在 App 传入（见 CanvasToolbar 注释） */}
            <CanvasToolbar
              minimapOn={minimapOn}
              onToggleMinimap={() => setMinimapOn((v) => !v)}
              onArrange={arrangeCanvas}
              onFitView={() => fitView({ padding: 0.2, duration: 800 })}
              onZoomIn={zoomInStep}
              onZoomOut={zoomOutStep}
              zoomPercent={zoomPercent}
              performanceMode={performanceMode}
              onTogglePerformance={() => setPerformanceMode((v) => !v)}
            />
          </div>
        </div>

        {/* 右键菜单（基座 ContextMenu，挂载于画布外层） */}
        <ContextMenu state={menu.state} items={menuItems} onClose={menu.close} containerRef={menu.containerRef} />
      </div>
    </LodProvider>
  )
}

export default function App() {
  return (
    <>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      {/* 统一通知容器（顶部居中，配合 toastStore.showToast 使用） */}
      <ToastContainer />
    </>
  )
}
