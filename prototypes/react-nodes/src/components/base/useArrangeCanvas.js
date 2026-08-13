import { useCallback } from 'react'
import dagre from 'dagre'

/**
 * 自动排版（复刻 H_.jsx:10985 `Ui` 整理画布 / Ctrl+L）。
 *
 * 原逻辑（docs/画布底层交互逆向记录.md §12.1）：
 *  - 用 dagre 做有向图分层布局：rankdir='LR'、nodesep=300、ranksep=300、align='UL'；
 *  - 支持 group 父子（compound graph，setParent）；
 *  - 布局后把节点按「连通分量」分组，逐分量摆位，超出宽度 2500 换列（列距 +300），分量内节点间距 +300；
 *  - group 节点保持测量尺寸，普通节点在分量内相对偏移摆位；
 *  - 写回新位置 + 全部节点 data.expanded=false，再 fitView 适配视图。
 *
 * 本 hook 只做「计算新布局并写回」，不含历史记录；调用方决定是否把结果/原快照入栈。
 *
 * @returns {arrange: Function} 传入当前节点/边快照与可选回调，执行 dagre 布局并写回。
 */
export function useArrangeCanvas() {
  /**
   * @param {Object} opts
   * @param {Array} opts.nodes           当前节点快照（含 measured/style/position/data/parentId）
   * @param {Array} opts.edges           当前边快照
   * @param {Function} opts.onArrange    写回回调，入参 { nodes, edges }（调用方 setNodes）
   * @param {Function} [opts.onComplete] 写回后回调（如 fitView）
   * @returns {Object} 返回 { nodes, edges } 以便调用方入历史栈 / 显示确认弹窗
   */
  const arrange = useCallback(({ nodes, edges, onArrange, onComplete } = {}) => {
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      onComplete?.()
      return { nodes, edges }
    }

    const graph = new dagre.graphlib.Graph({ compound: true })
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'LR', nodesep: 300, ranksep: 300, align: 'UL' })

    // 取节点真实尺寸：优先 measured（已渲染），其次显式 width/height/style，再退默认
    const nodeDim = (n, fallbackW, fallbackH) => {
      const styleW = Number(n.style?.width)
      const styleH = Number(n.style?.height)
      return {
        width: n.measured?.width || Number(n.width) || (Number.isFinite(styleW) && styleW > 0 ? styleW : 0) || fallbackW,
        height: n.measured?.height || Number(n.height) || (Number.isFinite(styleH) && styleH > 0 ? styleH : 0) || fallbackH,
      }
    }
    nodes.forEach((n) => {
      const isGroup = n.type === 'group'
      const { width, height } = nodeDim(n, isGroup ? 300 : 320, isGroup ? 200 : 80)
      graph.setNode(n.id, { width, height })
      if (n.parentId) graph.setParent(n.id, n.parentId)
    })
    edges.forEach((e) => {
      graph.setEdge(e.source, e.target)
    })
    dagre.layout(graph)

    // 按连通分量分组（BFS）：同一条边/同组内的节点聚成一列，独立分量各自成列
    const components = []
    const visited = new Set()
    const adj = new Map()
    nodes.forEach((n) => adj.set(n.id, []))
    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source).push(e.target)
      if (adj.has(e.target)) adj.get(e.target).push(e.source)
    })
    nodes.forEach((n) => {
      if (visited.has(n.id)) return
      const comp = []
      const queue = [n.id]
      for (visited.add(n.id); queue.length > 0; ) {
        const cur = queue.shift()
        const node = nodes.find((x) => x.id === cur)
        if (node) comp.push(node)
        adj.get(cur)?.forEach((nid) => {
          if (!visited.has(nid)) {
            visited.add(nid)
            queue.push(nid)
          }
        })
      }
      components.push(comp)
    })

    let colX = 0 // 当前列的原点 X
    let colY = 0 // 当前列的原点 Y
    let colH = 0 // 当前列已累积的高度（用于列宽判定）
    const laid = [] // 最终写回的新节点数组

    components.forEach((comp) => {
      // 分量包围盒（相对 dagre 输出的节点中心坐标）
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      comp.forEach((node) => {
        const pos = graph.node(node.id)
        if (pos) {
          minX = Math.min(minX, pos.x - pos.width / 2)
          minY = Math.min(minY, pos.y - pos.height / 2)
          maxX = Math.max(maxX, pos.x + pos.width / 2)
          maxY = Math.max(maxY, pos.y + pos.height / 2)
        }
      })
      const w = maxX - minX
      const h = maxY - minY

      // 超宽换列：列宽累计 > 2500 且当前列已有内容 → 换到下一列
      if (colX + w > 2500 && colX > 0) {
        colX = 0
        colY += colH + 400
        colH = 0
      }

      comp.forEach((node) => {
        const pos = graph.node(node.id)
        if (!pos) return
        let x = 0
        let y = 0
        if (node.parentId) {
          // group 子节点：保持相对父节点的偏移
          const parentPos = graph.node(node.parentId)
          if (parentPos) {
            x = pos.x - pos.width / 2 - (parentPos.x - parentPos.width / 2)
            y = pos.y - pos.height / 2 - (parentPos.y - parentPos.height / 2)
          }
        } else {
          // 普通节点：相对分量左上角摆位，加上列原点
          const relX = pos.x - pos.width / 2 - minX
          const relY = pos.y - pos.height / 2 - minY
          x = colX + relX
          y = colY + relY
        }
        laid.push({
          ...node,
          position: { x, y },
          data: { ...node.data, expanded: false },
          style: node.type === 'group' ? { ...node.style, width: pos.width, height: pos.height } : node.style,
        })
      })

      colX += w + 300
      colH = Math.max(colH, h)
    })

    const result = { nodes: laid, edges }
    onArrange?.(result)
    onComplete?.()
    return result
  }, [])

  return { arrange }
}
