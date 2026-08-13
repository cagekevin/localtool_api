import { buildShots, buildAssets } from './scriptBoxPrompts.js'

/**
 * 剧本盒子 —— 引擎层（假实现，模拟真实 H_.jsx 的 Ar/Pr/Fr/Ir 等回调）。
 *
 * 对应职责划分：引擎不依赖 UI，只通过「读 data + updateData 写回」与节点交互。
 * 真实接入时：把每个回调体替换为调用 gateway/模型生成，再把结果 updateData 写回即可，
 * 组件侧（ScriptBoxNode）只调 onXxx，完全无感知。
 *
 * 9 个回调端点（挂到 node.data，由 App 在创建节点时注入）：
 *  - onGenerateScript(Ar)            生成分镜 + 资产（剧情/风格/镜头数）
 *  - onGenerateAssetImage(Pr)        生成单个资产参考图
 *  - onGenerateAllAssetImages(Fr)    批量生成资产参考图
 *  - onGenerateShotPrompts(Ir)       生成全部/选中分镜的生图/生视频提示词
 *  - onStopScriptItem(Un)            停止某镜头生成（假实现空）
 *  - onRetryVideoAssetUpload(oi)     重试资产视频上传（假实现空）
 *  - onUploadAllVideoAssets(ai)      上传全部资产视频（假实现空）
 *  - onConnectShot(li)               单镜头连下游（建 promptNode/discountVideoNode）
 *  - onConnectShots(ui)              批量连下游
 *
 * @param deps
 *  - getData(): () => node.data        读当前 data
 *  - updateData(patch)                 写回 node.data
 *  - addNodes(nodes)                   建下游节点（onConnect* 用，可选）
 */
export function createScriptBoxEngine({ getData, updateData, addNodes }) {
  // 生成分镜 + 资产（假实现：同步用 buildShots/buildAssets，异步 setTimeout 模拟耗时）
  const onGenerateScript = () => {
    const d = getData()
    const n = d.shotCount === 'auto' ? 5 : typeof d.shotCount === 'number' ? d.shotCount : parseInt(d.customCount) || 5
    const shots = buildShots(Math.min(Math.max(n, 1), 300))
    const assets = buildAssets(d.globalStyle, d.customAssetTemplates)
    // 模拟引擎异步：先生成遮罩，800ms 后写回
    updateData({ genMask: true, genChars: 0, genSecs: 0 })
    setTimeout(() => {
      updateData({ shots, assets, projectName: d.projectName || '新故事', genMask: false })
    }, 800)
  }

  // 生成单个资产参考图（假实现：picsum 占位图）
  const onGenerateAssetImage = (assetId) => {
    updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: true } : a)) })
    setTimeout(() => {
      const assets = getData().assets.map((a) =>
        a.id === assetId
          ? {
              ...a,
              loading: false,
              has: true,
              imageUrl: `https://picsum.photos/seed/script-asset-${a.name}-${Date.now()}/240/240`,
              thumbnailUrl: `https://picsum.photos/seed/script-asset-${a.name}-${Date.now()}/80/80`
            }
          : a
      )
      updateData({ assets })
    }, 500)
  }

  // 批量生成资产参考图（假实现：逐个调单图，间隔错开）
  const onGenerateAllAssetImages = () => {
    getData().assets.forEach((a, i) => {
      setTimeout(() => onGenerateAssetImage(a.id), i * 250)
    })
  }

  // 生成分镜提示词（假实现：已由 buildShotPrompts 预填，这里标记完成）
  const onGenerateShotPrompts = (shotIds) => {
    const sel = shotIds ? new Set(shotIds) : null
    updateData({
      shots: getData().shots.map((s) => (sel && !sel.has(s.id) ? s : { ...s, promptLoading: true }))
    })
    setTimeout(() => {
      updateData({
        shots: getData().shots.map((s) => (sel && !sel.has(s.id) ? s : { ...s, promptLoading: false }))
      })
    }, 500)
  }

  // 停止生成（假实现：空，保留签名）
  const onStopScriptItem = () => {}

  // 重试单个资产视频上传（假实现：标记 uploading → uploaded）
  const onRetryVideoAssetUpload = (assetId) => {
    updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, videoStatus: 'uploading' } : a)) })
    setTimeout(() => {
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, videoStatus: 'uploaded' } : a)) })
    }, 600)
  }

  // 上传全部有图资产的视频（假实现：逐个标记 uploading → uploaded）
  const onUploadAllVideoAssets = () => {
    const list = getData().assets.filter((a) => a.has && a.videoStatus !== 'uploaded')
    if (!list.length) return
    updateData({ assets: getData().assets.map((a) => (a.has && a.videoStatus !== 'uploaded' ? { ...a, videoStatus: 'uploading' } : a)) })
    setTimeout(() => {
      updateData({ assets: getData().assets.map((a) => (a.has && a.videoStatus !== 'uploaded' ? { ...a, videoStatus: 'uploaded' } : a)) })
    }, 900)
  }

  // 连线（假实现：用 addNodes 建下游节点，未传 addNodes 则忽略）
  const onConnectShot = (shotId) => {
    if (!addNodes) return
    const d = getData()
    const shot = d.shots.find((s) => s.id === shotId)
    if (!shot) return
    const base = Date.now()
    addNodes([
      { id: `script-prompt-${shotId}-${base}`, type: 'promptNode', position: { x: 0, y: 0 }, data: { label: `镜头${shotId}图`, prompt: shot.prompt, images: [] } },
      { id: `script-video-${shotId}-${base}`, type: 'discountVideoNode', position: { x: 0, y: 0 }, data: { label: `镜头${shotId}视频`, prompt: shot.videoPrompt } }
    ])
  }
  const onConnectShots = (shotIds) => (shotIds || []).forEach((id) => onConnectShot(id))

  return {
    onGenerateScript,
    onGenerateAssetImage,
    onGenerateAllAssetImages,
    onGenerateShotPrompts,
    onStopScriptItem,
    onRetryVideoAssetUpload,
    onUploadAllVideoAssets,
    onConnectShot,
    onConnectShots
  }
}
