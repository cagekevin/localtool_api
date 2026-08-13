import React, { useState } from 'react'
import { ASSET_TEMPLATES, SCRIPT_WRITER_SYSTEM, SHOT_DIRECTOR_SYSTEM } from '../base/scriptBoxPrompts.js'

/**
 * 剧本盒子 齿轮设置弹窗（复刻原型 .gearModal）。
 * 分组：画面比例 / 生图生视频全局约束 / 剧本生成提示词 / 分镜生成提示词 / 三资产参考图模板。
 */
export default function GearSettings({ data, updateData, onClose }) {
  const d = data || {}
  const ratios = ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9']

  // 本地编辑态（保存时一次性写回，避免每次输入都触发全节点更新）
  const [aspectRatio, setAspectRatio] = useState(d.aspectRatio || '16:9')
  const [customAspectRatio, setCustomAspectRatio] = useState(d.customAspectRatio || '')
  const [imageConstraint, setImageConstraint] = useState(d.imageGlobalConstraint || '')
  const [videoConstraint, setVideoConstraint] = useState(d.videoGlobalConstraint || '')
  const [customGlobalConstraint, setCustomGlobalConstraint] = useState(d.customGlobalConstraint || '')
  const [scriptPrompt, setScriptPrompt] = useState(d.customScriptPrompt ?? SCRIPT_WRITER_SYSTEM)
  const [shotPrompt, setShotPrompt] = useState(d.customShotPrompt ?? SHOT_DIRECTOR_SYSTEM)
  const [tpl, setTpl] = useState(d.customAssetTemplates || { ...ASSET_TEMPLATES })

  const save = () => {
    updateData({
      aspectRatio,
      customAspectRatio,
      imageGlobalConstraint: imageConstraint,
      videoGlobalConstraint: videoConstraint,
      customGlobalConstraint,
      customScriptPrompt: scriptPrompt,
      customShotPrompt: shotPrompt,
      customAssetTemplates: tpl
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[720px] max-h-[88vh] bg-[#1c1c1e] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <div className="text-[13px] text-gray-200 font-medium">总体提示词设置</div>
          <button className="text-gray-500 hover:text-white text-[16px]" onClick={onClose}>×</button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-4 flex flex-col gap-5">
          {/* 画面比例 */}
          <div>
            <div className="text-[11px] text-gray-400 mb-2">画面比例</div>
            <div className="flex gap-1.5 flex-wrap">
              {ratios.map((r) => (
                <button key={r} onClick={() => setAspectRatio(r)} className={`px-2.5 py-1 text-[11px] rounded-md border ${aspectRatio === r ? 'border-white/40 text-white bg-[#2a2a2a]' : 'border-[#333] text-gray-400 hover:border-[#555]'}`}>{r}</button>
              ))}
              <button onClick={() => setAspectRatio('custom')} className={`px-2.5 py-1 text-[11px] rounded-md border ${aspectRatio === 'custom' ? 'border-white/40 text-white bg-[#2a2a2a]' : 'border-[#333] text-gray-400'}`}>自定义</button>
            </div>
            {aspectRatio === 'custom' && <input value={customAspectRatio} onChange={(e) => setCustomAspectRatio(e.target.value)} placeholder="如 2:1" className="mt-2 w-28 bg-[#161616] border border-[#333] rounded-md px-2 py-1 text-[11px] text-gray-200 outline-none nodrag" />}
          </div>

          {/* 全局约束 */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="图片全局约束"><textarea value={imageConstraint} onChange={(e) => setImageConstraint(e.target.value)} className="w-full bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-14 custom-scrollbar nodrag nowheel" /></Field>
            <Field label="视频全局约束"><textarea value={videoConstraint} onChange={(e) => setVideoConstraint(e.target.value)} className="w-full bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-14 custom-scrollbar nodrag nowheel" /></Field>
            <Field label="自定义全局约束"><textarea value={customGlobalConstraint} onChange={(e) => setCustomGlobalConstraint(e.target.value)} className="w-full bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-14 custom-scrollbar nodrag nowheel" /></Field>
          </div>

          {/* 剧本生成提示词 */}
          <div>
            <Field label="剧本生成提示词（用于把剧情拆成分镜）"><textarea value={scriptPrompt} onChange={(e) => setScriptPrompt(e.target.value)} className="w-full bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-28 custom-scrollbar nodrag nowheel" /></Field>
          </div>

          {/* 分镜生成提示词 */}
          <div>
            <Field label="分镜生成提示词（用于给单个分镜生图/生视频）"><textarea value={shotPrompt} onChange={(e) => setShotPrompt(e.target.value)} className="w-full bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-28 custom-scrollbar nodrag nowheel" /></Field>
          </div>

          {/* 资产参考图模板 */}
          <div>
            <div className="text-[11px] text-gray-400 mb-2">资产参考图生成模板</div>
            {[['character', '角色'], ['scene', '场景'], ['prop', '道具']].map(([k, n]) => (
              <div key={k} className="flex items-start gap-2 mb-2">
                <span className="w-10 text-[11px] text-gray-400 pt-1 shrink-0">{n}</span>
                <textarea value={tpl[k] || ''} onChange={(e) => setTpl({ ...tpl, [k]: e.target.value })} className="flex-1 bg-[#161616] border border-[#333] rounded-md p-2 text-gray-200 text-[11px] outline-none h-16 custom-scrollbar nodrag nowheel" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#333]">
          <button className="px-4 py-1.5 text-[12px] text-gray-400 hover:text-white" onClick={onClose}>取消</button>
          <button className="px-4 py-1.5 text-[12px] bg-[#27272a] hover:bg-[#333] text-gray-200 rounded-md" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-[11px] text-gray-400">{label}<div className="mt-1">{children}</div></label>
}
