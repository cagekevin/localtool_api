import React, { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useNodesState,
  useEdgesState
} from 'reactflow'
import { Type, Image as ImageIcon, Clapperboard, Trash2, Copy } from 'lucide-react'
import TextNode from './components/TextNode.jsx'
import ImageNode from './components/ImageNode.jsx'
import PromptNode from './components/PromptNode.jsx'
import DiscountVideoNode from './components/DiscountVideoNode.jsx'
import GroupNode from './components/GroupNode.jsx'
import ScriptBoxNode from './components/ScriptBoxNode.jsx'
import CustomEdge from './components/CustomEdge.jsx'
import ConnectionLine from './components/ConnectionLine.jsx'
import ContextMenu from './components/base/ContextMenu.jsx'
import { useContextMenu } from './components/base/useContextMenu.js'
import { useCanvasHistory } from './components/base/useCanvasHistory.js'
import { useCanvasShortcuts } from './components/base/useCanvasShortcuts.js'
import { paletteCategories, getNodesByCategory, defaultNodeData } from './components/base/NodePalette.jsx'
import LodProvider from './components/base/LodProvider.jsx'
import LodListener from './components/base/LodListener.jsx'

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
  scriptBoxNode: ScriptBoxNode
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
      title: '剧本盒子',
      story: '小马想要找到一片更好的草地，老牛和松鼠决定陪它一起出发。',
      style: '电影感',
      styleChips: ['电影感', '水墨风', '皮克斯3D', '赛博朋克'],
      shotCount: 'auto',
      customCount: '',
      model: 'lovart-chat',
      shots: [],
      assets: [],
      assetModel: 'gpt-image-2-low',
      aspectRatio: '16:9',
      imageGlobalConstraint: '',
      videoGlobalConstraint: '',
      customScriptPrompt: '',
      customShotPrompt: '',
      customAssetTemplates: ['', '', '']
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

  // 新增节点（复刻源码 di(type, position, data)）
  const addNode = useCallback(
    (type, position, data = {}) => {
      const id = `${type}-${Date.now()}`
      const newNode = { id, type, position: { ...position }, data: { label: '', ...data } }
      if (type === 'promptNode') {
        // 生图节点默认 420×420，避免端口跑偏
        Object.assign(newNode, { width: 420, height: 420, style: { width: 420, height: 420 } })
      }
      const nextNodes = [...nodesRef.current, newNode]
      setNodes(nextNodes)
      history.record({ nodes: nextNodes, edges: edgesRef.current })
      return id
    },
    [setNodes, history]
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
            onClick: () => addNode(n.type, { x: state.x, y: state.y }, defaultNodeData(n.type))
          }))
        }
      })
      .filter(Boolean)

    return [
      { key: 'text', icon: <Type size={16} className="text-green-500" />, label: '文本', shortcut: 'Q', onClick: () => addNode('textNode', { x: state.x, y: state.y }, defaultNodeData('textNode')) },
      { key: 'image', icon: <ImageIcon size={16} className="text-blue-400" />, label: '图片', shortcut: 'W', onClick: () => addNode('promptNode', { x: state.x, y: state.y }, defaultNodeData('promptNode')) },
      { key: 'video', icon: <Clapperboard size={16} className="text-yellow-500" />, label: '视频', shortcut: 'E', onClick: () => addNode('discountVideoNode', { x: state.x, y: state.y }, defaultNodeData('discountVideoNode')) },
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

  // 根据菜单类型分发到对应配置
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
    onAdd: (type) => {
      // 快速添加节点到固定位置（复刻 Q/W/E）
      const center = { x: 200, y: 200 }
      addNode(type, center, defaultNodeData(type))
    }
  })

  // 连线
  const onConnect = useCallback(
    (params) => {
      const nextEdges = [...edgesRef.current, { ...params, type: 'default', animated: false }]
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    },
    [setEdges, history]
  )

  // 删除连线（CustomEdge 的删除按钮通过 window 事件触发）
  useEffect(() => {
    const handler = (e) => {
      const { id } = e.detail || {}
      if (!id) return
      const nextEdges = edgesRef.current.filter((ed) => ed.id !== id)
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    }
    window.addEventListener('yimao:remove-edge', handler)
    return () => window.removeEventListener('yimao:remove-edge', handler)
  }, [setEdges, history])

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
          proOptions={proOptions}
          minZoom={0.05}
          maxZoom={4}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
        >
          {/* 点阵网格：gap=20 / size=1 / color=#333（复刻 H_.jsx:12100） */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#333"
            bgColor="#0d0c0c"
          />
          <Controls position="bottom-left" />
          {/* LOD 视口缩放监听（基座 LodListener） */}
          <LodListener onLodChange={setLodLevel} />
        </ReactFlow>

        {/* 右键菜单（基座 ContextMenu，挂载于画布外层） */}
        <ContextMenu state={menu.state} items={menuItems} onClose={menu.close} containerRef={menu.containerRef} />
      </div>
    </LodProvider>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
