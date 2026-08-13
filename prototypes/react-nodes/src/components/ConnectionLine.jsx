import React from 'react'
import { getBezierPath, Position } from 'reactflow'
import { useLod } from './base/useLod.js'

/**
 * 拖拽中的临时连线（复刻原 Pg.jsx）
 * 与选中 comet 同一套视觉：cust-edge-glow + cust-edge-base is-active + 16 拖尾圆 + 发光头。
 * 固定 sourcePosition:Right / targetPosition:Left。
 *
 * LOD 降级（复刻 Pg.jsx 的 f = o < 2）：lodLevel >= 2（缩到很小）时关闭辉光与粒子流，
 * 只保留基础线，节省大画布性能。
 */
export default function ConnectionLine({ fromX, fromY, toX, toY }) {
  const { lodLevel = 0 } = useLod()
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left
  })

  const mpathId = 'cust-conn-mpath'
  const filterId = 'cust-conn-filter'
  const dur = '1.8s'
  const enableFx = lodLevel < 2 // 复刻 Pg.jsx：lodLevel < 2 才渲染辉光 + 粒子

  // 16 个拖尾点（同 comet）
  const dots = []
  for (let e = 0; e < 16; e++) {
    const t = e / 15
    const r = 4.6 - t * 4
    const op = Math.max(0.05, 1 - t * 1.05)
    const begin = e * 18
    dots.push([r, op, begin])
  }

  return (
    <g fill="none">
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path id={mpathId} d={path} fill="none" stroke="none" />
      {enableFx && <path d={path} fill="none" className="cust-edge-glow is-active" />}
      <path d={path} fill="none" className="cust-edge-base is-active" />

      {enableFx && (
        <>
          <g filter={`url(#${filterId})`} aria-hidden={true}>
            {dots.map(([r, op, begin], i) => (
              <circle r={r} fill="#ffffff" opacity={op} key={`conn-c-${i}`}>
                <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin={`-${begin}ms`}>
                  <mpath xlinkHref={`#${mpathId}`} />
                </animateMotion>
              </circle>
            ))}
          </g>
          {/* 头部主光点（半径 3.6，比选中态 comet 略大） */}
          <circle
            r={3.6}
            fill="#ffffff"
            opacity={1}
            style={{
              filter:
                'drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))'
            }}
          >
            <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin="0s">
              <mpath xlinkHref={`#${mpathId}`} />
            </animateMotion>
          </circle>
        </>
      )}
    </g>
  )
}
