import React, { useState, useEffect, useRef } from 'react'
import { Clapperboard, Settings, Maximize2, Loader2 } from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import FullscreenModal from './base/FullscreenModal.jsx'
import { useScriptBoxData } from './base/useScriptBoxData.js'
import { useScriptBoxEngine } from './base/useScriptBoxEngine.js'
import { useOutsideClick } from './base/hooks.js'
import StepShots from './scriptbox/StepShots.jsx'
import StepAssets from './scriptbox/StepAssets.jsx'
import StepPrompt from './scriptbox/StepPrompt.jsx'
import GearSettings from './scriptbox/GearSettings.jsx'

/**
 * 剧本盒子（scriptBoxNode）—— 复刻 c_.jsx，按 docs/剧本盒子 的职责架构实现。
 *
 * 数据模型：单一数据源 node.data（shots/assets/配置 + 9 个 onXxx 引擎回调）。
 * 职责铁律：
 *  - 本组件只「读 node.data」（直接读 data prop），任何编辑都经 useScriptBoxData.updateData 写回；
 *  - 任何「生成/连线」都只调 d.onXxx?.(...)（引擎回调），本组件不做计算；
 *  - 引擎回调由 useScriptBoxEngine 注入 node.data.onXxx（经 setNodes/addNodes/坐标写回）；
 *  - 引擎（scriptBoxEngine.js）不依赖 UI，经 setNodes 写回；纯函数（scriptBoxPrompts.js）无副作用。
 *
 * 三步状态机：①确认镜头 ②准备资产 ③合成提示词（可点击切换，不自动连跑）。
 */
export default function ScriptBoxNode({ id, data, selected }) {
  // 数据读写通道（读 data 直接用 props，写经 updateData）
  const { updateData } = useScriptBoxData(id)

  // 引擎回调：由 useScriptBoxEngine 创建并注入 node.data.onXxx（含连线，能建下游）。
  // 本组件只调 d.onXxx?.(...)，不做引擎。
  useScriptBoxEngine(id, data)

  const d = data || {}

  // —— UI 状态（非数据，放组件本地） ——
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const settingsRef = useRef(null)
  useOutsideClick(settingsRef, settingsOpen, () => setSettingsOpen(false))

  // 生成遮罩计时
  const genMask = !!d.genMask
  const [genSecs, setGenSecs] = useState(0)
  useEffect(() => {
    if (!genMask) return
    setGenSecs(0)
    const t = setInterval(() => setGenSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [genMask])

  const step = d.step || 1
  const setStep = (n) => updateData({ step: n })

  // 三步组件只调 d.onXxx?.(...)（引擎回调，由 useScriptBoxEngine 注入 node.data.onXxx）。
  const stepProps = { id, data: d, updateData, callbacks: d }

  return (
    <NodeShell
      id={id}
      label={d.label}
      defaultTitle="剧本盒子"
      icon={<Clapperboard size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      minWidth={900}
      minHeight={600}
      className="min-w-[900px]"
      style={{ height: 680, minHeight: 680, width: 900, minWidth: 900 }}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] w-full drag-handle cursor-move shrink-0">
        <Clapperboard size={14} className="text-gray-500" />
        <span className="text-[13px] text-gray-300 font-medium">{d.projectName || '剧本盒子'}</span>
        {genMask && (
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#262626] px-2.5 py-1 rounded-full">
            <Loader2 size={11} className="animate-spin text-emerald-400" />
            生成中 {d.genChars || 0} 字 · {genSecs}s
          </span>
        )}
        <div className="flex-1" />
        <button className="p-1 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md" title="总体提示词设置" onClick={(e) => { e.stopPropagation(); setSettingsOpen(true) }}>
          <Settings size={13} />
        </button>
        <button className="p-1 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md" title="全屏显示" onClick={(e) => { e.stopPropagation(); setFullscreen(true) }}>
          <Maximize2 size={13} />
        </button>
      </div>

      {/* 三步导航 */}
      <StepNav step={step} setStep={setStep} shots={d.shots} assets={d.assets} />

      {/* 三步内容 */}
      <div className="px-4 pb-4 flex-1 min-h-0 overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        {step === 1 && <StepShots {...stepProps} />}
        {step === 2 && <StepAssets {...stepProps} />}
        {step === 3 && <StepPrompt {...stepProps} />}
      </div>

      {/* 齿轮设置弹窗 */}
      {settingsOpen && (
        <div ref={settingsRef}>
          <GearSettings data={d} updateData={updateData} onClose={() => setSettingsOpen(false)} />
        </div>
      )}

      {/* 全屏弹层 */}
      <FullscreenModal open={fullscreen} title={d.projectName || '剧本盒子'} onClose={() => setFullscreen(false)}>
        <div className="flex-1 flex flex-col min-h-0 overflow-auto">
          {step === 1 && <StepShots {...stepProps} />}
          {step === 2 && <StepAssets {...stepProps} />}
          {step === 3 && <StepPrompt {...stepProps} />}
        </div>
      </FullscreenModal>
    </NodeShell>
  )
}

/** 三步圆环导航（进度环：镜头/资产/提示词 完成度） */
function StepNav({ step, setStep, shots, assets }) {
  const t = (shots || []).length
  const n = (assets || []).length
  const i = (assets || []).filter((a) => a.has).length
  const a = (shots || []).filter((s) => s.prompt || s.videoPrompt).length
  const steps = [
    { n: 1, title: '确认镜头', desc: t ? `${t}镜头` : '暂无镜头', p: +(t > 0) },
    { n: 2, title: '准备资产', desc: n ? `${i}/${n}` : '暂无资产', p: n ? i / n : 0 },
    { n: 3, title: '合成提示词', desc: t ? `${a}/${t}` : '暂无镜头', p: t ? a / t : 0 }
  ]
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 shrink-0">
      {steps.map((s, k) => {
        const active = step === s.n
        const off = 2 * Math.PI * 11 * (1 - s.p)
        return (
          <React.Fragment key={s.n}>
            <button className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${active ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]'}`} onClick={() => setStep(s.n)}>
              <svg width="28" height="28" className="shrink-0">
                <circle cx="14" cy="14" r="11" fill="none" stroke={active ? '#3a3a3a' : '#2a2a2a'} strokeWidth="2" />
                <circle cx="14" cy="14" r="11" fill="none" stroke={active ? '#fff' : '#666'} strokeWidth="2" strokeDasharray={2 * Math.PI * 11} strokeDashoffset={off} transform="rotate(-90 14 14)" style={{ transition: 'all .3s' }} />
                <text x="14" y="18" textAnchor="middle" fontSize="11" fontWeight="600" fill={active ? '#fff' : '#9ca3af'}>{s.n}</text>
              </svg>
              <span className="text-left">
                <span className={`block text-[12px] font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{s.title}</span>
                <span className="block text-[10px] text-gray-500">{s.desc}</span>
              </span>
            </button>
            {k < steps.length - 1 && <div className="w-10 h-px bg-[#333]" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}
