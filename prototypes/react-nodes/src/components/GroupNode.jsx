import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { FoldVertical, ChevronsUpDown, Folder } from 'lucide-react'

/**
 * 群组 / 分组节点（复刻原 Og.jsx / group 节点）。
 *
 * 两种形态：
 *  - 折叠态（data.collapsed）：渲染为 h-40px 的横向小胶囊，含左右端口，可整体拖动；
 *  - 展开态：容器背景 + 顶部标题栏（双击重命名、折叠按钮）。
 *
 * 由 React Flow 父子节点机制承载：作为父节点，子节点通过 parentId 挂在其下。
 * 尺寸：折叠时 width=max-content, height=40；展开时恢复 expandedWidth/expandedHeight（默认 300×200）。
 */
export default function GroupNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(data?.name || '编组')
  const inputRef = useRef(null)
  const collapsed = data?.collapsed || false

  // 进入重命名时自动聚焦并全选
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitName = () => {
    setEditing(false)
    // reactflow v11 无 updateNodeData，用 setNodes 更新 data（复刻 Og.jsx f 函数）
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n))
    )
  }
  const onKeyDown = (e) => {
    if (e.key === 'Enter') commitName()
  }

  // 折叠 / 展开切换（复刻 Og.jsx m 函数：折叠时存 expandedWidth/Height，置透明无边框；展开时恢复）
  const toggleCollapse = (e) => {
    e.stopPropagation()
    const next = !collapsed
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n
        if (next) {
          const w = n.style?.width || n.measured?.width || 300
          const h = n.style?.height || n.measured?.height || 200
          return {
            ...n,
            data: { ...n.data, collapsed: true, expandedWidth: w, expandedHeight: h },
            style: { ...n.style, width: 'max-content', height: 40, backgroundColor: 'transparent', border: 'none' }
          }
        }
        return {
          ...n,
          data: { ...n.data, collapsed: false },
          style: {
            ...n.style,
            width: n.data?.expandedWidth || 300,
            height: n.data?.expandedHeight || 200,
            backgroundColor: undefined,
            border: undefined
          }
        }
      })
    )
  }

  if (collapsed) {
    return (
      <div
        className={`relative flex items-center justify-center bg-[#2a1f24] border border-dashed ${selected ? 'border-edge-strong' : 'border-edge-muted'} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] cursor-pointer hover:bg-[#352a30] hover:border-gray-400 transition-all duration-300`}
        onClick={toggleCollapse}
      >
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0" />
        <FoldVertical className="w-4 h-4 text-gray-400 mr-1" />
        <Folder className="w-4 h-4 text-[#8b92a5] mr-2" />
        <span className="text-gray-300 text-sm select-none">{name}</span>
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0" />
      </div>
    )
  }

  return (
    <div
      className={`relative w-full h-full rounded-xl transition-all duration-300 ${selected ? 'border border-edge-strong' : 'border border-transparent hover:border-white/10'} bg-[#1e171b]/50 hover:bg-[#161214] group`}
    >
      <div className="absolute -top-8 left-0 flex items-center px-2 py-1" onDoubleClick={() => setEditing(true)}>
        <button onClick={toggleCollapse} className="mr-1 hover:bg-white/10 rounded p-0.5 transition-colors">
          <ChevronsUpDown className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
        </button>
        <Folder className="w-4 h-4 text-[#8b92a5] mr-1.5" />
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={onKeyDown}
            className="bg-surface-hover border border-edge-muted rounded outline-none text-gray-200 text-sm w-32 focus:border-blue-500 px-1 py-0.5"
          />
        ) : (
          <span className="text-gray-400 group-hover:text-gray-300 text-sm select-none cursor-text transition-colors">{name}</span>
        )}
      </div>
    </div>
  )
}
