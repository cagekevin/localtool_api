/**
 * 通用编组能力（治根：Agent group_nodes 与右键「编组」共用同一套逻辑）。
 *
 * 依赖 React Flow 父子节点机制：子节点设 parentId 挂在 group 下，position 为相对父节点坐标。
 * 本模块是纯函数：输入当前节点数组 + 目标 id → 输出新的节点数组。由调用方（右键菜单 /
 * Agent 工具）用 setNodes / ctx.setNodes 应用。保持纯函数便于测试与两端复用。
 *
 * 为什么不放在 GroupNode.jsx：编组动作是「对多个节点的画布操作」，不属于单个节点内部渲染。
 * 与 useNodeGeneration / getNodeOutput 同一方法论——把能力收敛到统一入口，UI 与 Agent 复用。
 */

/** 节点的实际尺寸（style 优先，其次 measured，兜底默认） */
function nodeSize(n) {
  return {
    w: Number(n.style?.width) || n.measured?.width || 150,
    h: Number(n.style?.height) || n.measured?.height || 80,
  }
}

/**
 * 编组：建一个 group 节点包住目标节点，并把目标节点设为子节点（parentId + 相对坐标）。
 * @param {Array} nodes 当前全部节点
 * @param {Array<string>} selectedIds 要编组的节点 id
 * @returns {{ok:boolean, nodes?:Array, groupId?:string, error?:string}}
 */
export function createGroupFromNodes(nodes, selectedIds) {
  const ids = Array.isArray(selectedIds) ? selectedIds : []
  // 只编组「普通节点」：排除 group 自身、以及已在其他组内的节点
  const targets = nodes.filter(
    (n) => ids.includes(n.id) && n.type !== 'group' && !n.parentId
  )
  if (!targets.length) return { ok: false, error: '没有可编组的节点' }

  // 计算外接矩形（用节点绝对坐标 + 尺寸）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of targets) {
    const { w, h } = nodeSize(n)
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + w)
    maxY = Math.max(maxY, n.position.y + h)
  }
  const pad = 24
  const gx = minX - pad
  const gy = minY - pad
  const gw = Math.max(120, maxX - minX + pad * 2)
  const gh = Math.max(80, maxY - minY + pad * 2)
  const groupId = `group-${Date.now().toString(36)}`

  const groupNode = {
    id: groupId,
    type: 'group',
    position: { x: gx, y: gy },
    style: { width: gw, height: gh },
    data: { name: '编组' },
    selected: false,
  }

  const next = nodes.map((n) =>
    targets.some((t) => t.id === n.id)
      ? {
          ...n,
          parentId: groupId,
          // 子节点 position 转相对父节点坐标
          position: { x: n.position.x - gx, y: n.position.y - gy },
          selected: false,
        }
      : n
  )
  next.push(groupNode)
  return { ok: true, nodes: next, groupId }
}

/**
 * 取消编组：移除 group 节点，并把其子节点移出组（parentId 置空 + position 转回绝对坐标）。
 * @param {Array} nodes 当前全部节点
 * @param {string} groupId 要取消的组节点 id
 * @returns {{ok:boolean, nodes?:Array, error?:string}}
 */
export function ungroupNodes(nodes, groupId) {
  const group = nodes.find((n) => n.id === groupId)
  if (!group) return { ok: false, error: '组不存在' }
  const gx = group.position.x
  const gy = group.position.y
  const next = nodes
    .filter((n) => n.id !== groupId)
    .map((n) =>
      n.parentId === groupId
        ? { ...n, parentId: undefined, position: { x: n.position.x + gx, y: n.position.y + gy } }
        : n
    )
  return { ok: true, nodes: next }
}
