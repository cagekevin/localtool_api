import { buildShots, buildAssets, buildShotImageUser, getImageGenSys, collectAssets, IMAGE_GEN_TYPES, IMAGE_GEN_DEFAULT } from './scriptBoxPrompts.js'

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
 *  - nodeId                            剧本盒子节点 id（连线 source 用）
 *  - setEdges(updater)                 建边（onConnect* 自动连线用，可选）
 *  - getNodes()                        读节点位置（下游往右偏移用，可选）
 */
export function createScriptBoxEngine({ getData, updateData, addNodes, nodeId, setEdges, getNodes }) {
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

  // ── 生成分镜提示词（生图 prompt + 生视频 videoPrompt）──
  // 真实现（对齐官方 H_.jsx Ir）：
  //   · 入参 shotIds：undefined=全部镜头；单 id=单镜；数组=批量多镜。
  //   · 每个目标镜头：
  //       1) 收集该镜引用的资产（在 description/prompt/videoPrompt/dialogue 里 @名 匹配且有 imageUrl 的）
  //       2) 用 assembleShotUser（官方 Nr）拼 user content：镜头编号/时长/景别/光影/运镜/画面描述/
  //          对白（原样带入 videoPrompt）/音效/统一风格/涉及资源
  //       3) system = customShotPrompt（可被齿轮设置覆盖）或内置分镜导演提示词
  //       4) 调文本模型 /v1/chat/completions，response_format=json_object，返回 { prompt, videoPrompt }
  //       5) 写回 shot.prompt / shot.videoPrompt；过程 shot.promptLoading=true
  //   · 多个镜头并发请求（官方 Promise.all + AbortController 存 zt 用于 onStopScriptItem 中止）
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

  // ── 上传全部有图资产的素材（为生视频准备参考图）──
  // 真实现（对齐官方 H_.jsx ai + ii + wr）：
  //   · ai（本回调）：
  //       1) 取所有有 imageUrl 的资产
  //       2) 把这些资产的 @名称 批量追加到每个分镜 description 末尾
  //       3) 调 ii() 上传队列
  //   · ii（上传队列）：
  //       1) 收集被分镜引用（@名 匹配）且有图资产的 imageUrl，过滤掉已上传的
  //       2) 更新 videoAssetUploadStatus={url:'uploading'}、videoAssetUploadProgress={completed,total,status}
  //       3) 并发最多 6 个，逐个调 wr(imageUrl,'image')
  //       4) 完成：videoUploadedAssets[url]=file_url、videoAssetUploadStatus[url]='uploaded'
  //       5) 失败：videoAssetUploadStatus[url]='failed' + videoAssetUploadErrors[url]=错误
  //   · wr（单个上传）：data:/blob:/本地 /files/ 的图片才传；转 Blob 后 POST ${p}/v1/gateway/upload
  //       （p=特惠视频网关 base），FormData file，返回 file_url；远程 url 原样返回
  const onUploadAllVideoAssets = () => {
    const list = getData().assets.filter((a) => a.has && a.videoStatus !== 'uploaded')
    if (!list.length) return
    updateData({ assets: getData().assets.map((a) => (a.has && a.videoStatus !== 'uploaded' ? { ...a, videoStatus: 'uploading' } : a)) })
    setTimeout(() => {
      updateData({ assets: getData().assets.map((a) => (a.has && a.videoStatus !== 'uploaded' ? { ...a, videoStatus: 'uploaded' } : a)) })
    }, 900)
  }

  // 连线（假实现：按 target 建对应下游节点并自动连线，下游往右排布）
  // target='image' → 只建生图 promptNode；target='video' → 只建生视频 discountVideoNode
  const onConnectShot = (shotId, target = 'image') => {
    if (!addNodes) return
    const d = getData()
    const shot = d.shots.find((s) => s.id === shotId)
    if (!shot) return
    const base = Date.now()
    const isImage = target !== 'video'
    const nodeId2 = `script-${isImage ? 'prompt' : 'video'}-${shotId}-${base}`
    // 资产自动匹配：按该镜头里的 @资产名 收集「有图资产」作为参考图（复刻官方 Ra）。
    // 下游 promptNode/discountVideoNode 用这些图作参考，保证画面里角色/场景一致。
    const refImages = collectAssets(shot, d.assets)
    // 下游往右排布：以剧本盒子节点位置为基准，向右偏移（节点宽度 900 + 间距 120）
    let rightBase = { x: 0, y: 0 }
    if (getNodes && nodeId) {
      const self = getNodes().find((n) => n.id === nodeId)
      if (self?.position) rightBase = { x: self.position.x + (self.width ?? 900) + 120, y: self.position.y }
    }
    addNodes([
      isImage
        ? { id: nodeId2, type: 'promptNode', position: { x: rightBase.x, y: rightBase.y }, data: { label: `镜头${shot.index}图`, prompt: shot.prompt, images: refImages } }
        : { id: nodeId2, type: 'discountVideoNode', position: { x: rightBase.x, y: rightBase.y }, data: { label: `镜头${shot.index}视频`, prompt: shot.videoPrompt, refImages } }
    ])
    // 自动连线：剧本盒子 → 下游（sourceHandle=shot-${id}，每条边对应一个镜头）
    if (setEdges && nodeId) {
      setEdges((es) => [
        ...es,
        { id: `e-${nodeId}-${nodeId2}`, source: nodeId, sourceHandle: `shot-${shotId}`, target: nodeId2, type: 'default', animated: false }
      ])
    }
  }
  const onConnectShots = (shotIds, target = 'image') => (shotIds || []).forEach((id) => onConnectShot(id, target))

  // ── AI 生成图提示词（关键帧/四宫格/九宫格/俯视调度图）──
  // 真链路：把 buildShotImageUser(shot, type, ctx) 作为 user message +
  // getImageGenSys(type, cur.customImageGenTemplates)（可被设置里自定义覆盖）作为 system，
  // 发给文本大模型（与 onGenerateShotPrompts 相同的 chat/completions 调用），拿回纯文本 prompt，
  // 存到 shot.imgGen = { type, prompt, ts }。UI 确认后可将 prompt 应用到 shot.prompt / 连线。
  const onGenerateShotImage = (shotId, type = IMAGE_GEN_DEFAULT) => {
    if (!IMAGE_GEN_TYPES[type]) type = IMAGE_GEN_DEFAULT
    const d = getData()
    updateData({ shots: d.shots.map((s) => (s.id === shotId ? { ...s, imgGenLoading: true } : s)) })
    // 假实现：异步延时后生成一段带类型的示意提示词（真实现换成 LLM 调用）
    setTimeout(() => {
      const cur = getData()
      const shot = (cur.shots || []).find((s) => s.id === shotId)
      if (!shot) return
      const ctx = { globalStyle: cur.globalStyle, assets: cur.assets }
      // 生效的 system 提示词：用户设置里可自定义覆盖（customImageGenTemplates）
      const system = getImageGenSys(type, cur.customImageGenTemplates)
      const t = IMAGE_GEN_TYPES[type]
      const meta = {
        type,
        label: t.label,
        prompt: `[${t.label}] ${shot.description || '（无画面描述）'}${shot.shotType ? `，景别：${shot.shotType}` : ''}${shot.lighting ? `，光影：${shot.lighting}` : ''}${shot.motion ? `，运镜：${shot.motion}` : ''}。${t.label === '俯视调度图' ? '以正上方90°俯视视角绘制场景平面、角色走位轨迹与机位朝向。' : type === 'grid4' ? '拆成严格等分的2×2四宫格连贯叙事，各格无缝衔接、风格一致。' : type === 'grid9' ? '拆成严格等分的3×3九宫格连贯叙事，各格无缝衔接、风格一致。' : '提炼这一镜最具张力的一帧关键瞬间，静态成图。'}`,
      }
      updateData({
        shots: (getData().shots || []).map((s) =>
          s.id === shotId ? { ...s, imgGenLoading: false, imgGen: { ...meta, ts: Date.now() } } : s
        ),
      })
    }, 700)
  }

  return {
    onGenerateScript,
    onGenerateAssetImage,
    onGenerateAllAssetImages,
    onGenerateShotPrompts,
    onStopScriptItem,
    onRetryVideoAssetUpload,
    onUploadAllVideoAssets,
    onConnectShot,
    onConnectShots,
    onGenerateShotImage
  }
}
