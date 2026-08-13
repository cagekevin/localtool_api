import React, { useEffect, useRef } from 'react'
import { Handle } from 'reactflow'

/**
 * 自定义连接端口（复刻原 _Component12.jsx）
 * 大号（48px）用于特惠视频节点，小号（32px）用于文本/图片节点。
 * position: 'left' | 'right'
 */
export default function CustomHandle({ className = '', variant = 'large', position, style = {} }) {
  const isLeft = position === 'left'
  const isRight = position === 'right'
  const size = variant === 'large' ? 48 : 32
  const half = size / 2
  const ref = useRef(null)
  const outerOffset = typeof style?.top === 'string' || typeof style?.top === 'number' ? 16 : 16

  // 复刻 mousemove 追踪（--cust-shift-x/y）
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let dx = Math.max(-14, Math.min(14, (e.clientX - cx) * 0.35))
      let dy = Math.max(-14, Math.min(14, (e.clientY - cy) * 0.35))
      if (isLeft) dx = Math.min(0, dx)
      else if (isRight) dx = Math.max(0, dx)
      el.style.setProperty('--cust-shift-x', `${dx}px`)
      el.style.setProperty('--cust-shift-y', `${dy}px`)
    }
    const reset = () => {
      el.style.setProperty('--cust-shift-x', '0px')
      el.style.setProperty('--cust-shift-y', '0px')
    }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', reset)
    return () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', reset)
    }
  }, [isLeft, isRight])

  const wrapStyle = {
    position: 'absolute',
    top: `calc(50% - ${half}px)`,
    width: size,
    height: size,
    ...(isLeft ? { left: -outerOffset } : isRight ? { right: -outerOffset } : {}),
    '--cust-anchor-x': isLeft ? '50%' : isRight ? '50%' : '50%'
  }

  return (
    <div
      ref={ref}
      className={`cust-handle-wrap ${variant === 'small' ? 'is-small' : ''}`}
      style={wrapStyle}
    >
      <Handle
        type={position === 'left' ? 'target' : 'source'}
        position={position === 'left' ? 'left' : 'right'}
        className={`!absolute !inset-0 !w-full !h-full !min-w-0 !min-h-0 !top-0 !left-0 !right-0 !bottom-0 !transform-none !bg-transparent !border-0 !rounded-none !opacity-0 ${className || ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          margin: 0,
          transform: 'none',
          background: 'transparent',
          border: 0,
          borderRadius: 0,
          opacity: 0
        }}
      />
      <span className="cust-handle-ring" />
      <span className="cust-handle-plus" />
      <span className="cust-handle-dot" />
    </div>
  )
}
