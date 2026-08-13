import React from 'react'

/**
 * 彗星流光（复刻原 _Component111.jsx）
 * 16 个拖尾圆点 + 1 个发光头，纯 SVG <animateMotion> 沿隐藏 path 运动，dur 1.8s。
 * pathRef 指向 CustomEdge 里那条隐藏 path（id=cust-edge-mpath-{edgeId}）。
 */
export default function Comet({ pathRef, edgeId, isActive }) {
  const dur = '1.8s'
  // 16 个拖尾点：半径 4.6→0.6，透明度 1→0.05，begin 逐点错开 18ms
  const dots = []
  for (let e = 0; e < 16; e++) {
    const t = e / 15
    const r = 4.6 - t * 4
    const op = Math.max(0.05, 1 - t * 1.05)
    const begin = e * 18
    dots.push([r, op, begin])
  }
  const filterId = `cust-edge-filter-${edgeId}`

  return (
    <g className={`cust-edge-comet ${isActive ? 'is-active' : ''}`} aria-hidden={true}>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {dots.map(([r, op, begin], o) => (
          <circle r={r} fill="#ffffff" opacity={op} key={`${edgeId}-c-${o}`}>
            <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin={`-${begin}ms`}>
              <mpath xlinkHref={`#${pathRef}`} />
            </animateMotion>
          </circle>
        ))}
      </g>
      {/* 头部主光点：白 + 蓝双 drop-shadow 发光 */}
      <circle
        r={3.4}
        fill="#ffffff"
        opacity={1}
        style={{
          filter:
            'drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))'
        }}
      >
        <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin="0s">
          <mpath xlinkHref={`#${pathRef}`} />
        </animateMotion>
      </circle>
    </g>
  )
}
