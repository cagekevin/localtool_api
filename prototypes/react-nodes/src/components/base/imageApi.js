/**
 * 生图 API（经 localTool /api/proxy → 供应商，多 provider 通用）。
 * PromptNode → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/images/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://images/generations，localTool 拼 base+key
 *
 * 同步/异步由供应商配置 provider.image_mode 决定（API 设置页「图片生成模式」）：
 *  - sync ：URL 带 ?wait=1 → 网关同步 SSE 返回（progress + status:succeeded + results[].url）
 *  - async：提交返回 [{status:"submitted", task_id}] → 轮询 GET /v1/tasks/{id} 到 completed
 *           取 result.images[].url
 * localTool 不再强制注入 wait，只按前端请求透传。
 */
import { resolveRefImages } from './refImage.js'
const API_BASE = 'http://127.0.0.1:18080'

function buildTargetUrl(provider, path) {
  const proto = provider?.protocol || 'apimart'
  if (proto === 'openai') return `openai://${path}`
  const base = (provider?.base_url || '').replace(/\/$/, '')
  return `${base}/v1/${path}`
}

/** 经 localTool /api/proxy 转发（兼容 GET/POST，body 为对象） */
async function proxyRequest({ provider, url, method = 'POST', body }) {
  const payload = { url, method }
  if (body) payload.body = JSON.stringify(body)
  if (provider?.id) payload.providerId = provider.id
  console.log(`[imageApi] ${method} 请求 payload=`, JSON.stringify(payload))
  let res
  try {
    res = await fetch(`${API_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error(`[imageApi] ${method} fetch 异常:`, e.message)
    throw e
  }
  console.log(`[imageApi] ${method} 响应 status=`, res.status, 'url=', url)
  return res
}

async function readError(res) {
  let msg = `HTTP ${res.status}`
  try {
    const j = await res.json()
    msg = j?.error?.message || j?.message || j?.detail || msg
  } catch { /* ignore */ }
  return msg
}

/** 同步模式：URL 带 ?wait=1，读 SSE 流提取图片 URL */
async function generateSync({ provider, url, genBody }, onProgress) {
  let waitUrl = url
  try {
    const u = new URL(url)
    u.searchParams.set('wait', '1')
    waitUrl = u.toString()
  } catch { /* 解析失败则原样 */ }

  let res
  try {
    res = await proxyRequest({ provider, url: waitUrl, method: 'POST', body: genBody })
  } catch (e) {
    return { ok: false, error: `网络错误：${e.message}` }
  }
  if (!res.ok) {
    const msg = await readError(res)
    console.error(`[imageApi] 同步提交失败 status=${res.status} msg=`, msg)
    return { ok: false, error: msg }
  }
  console.log(`[imageApi] 同步(SSE)提交成功，开始读流 waitUrl=`, waitUrl)

  // 解析 SSE 流：data: {progress}|{status:succeeded,results[].url}|[DONE]
  try {
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let urlFound = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const raw = t.slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          console.log(`[imageApi] SSE 事件=`, JSON.stringify(evt).slice(0, 300))
          if (typeof evt.progress === 'number' && onProgress) onProgress(evt.progress)
          // 兼容两种结果形态：{results:[{url}]} 与 {result.images[].url}
          const imgUrl = evt?.results?.[0]?.url || evt?.result?.images?.[0]?.url
          if (evt.status === 'succeeded' && imgUrl) {
            urlFound = imgUrl
            console.log(`[imageApi] SSE 捕获到图片 url=`, urlFound)
          }
          if (evt.error) {
            console.error(`[imageApi] SSE 返回 error=`, evt.error)
            return { ok: false, error: evt.error }
          }
        } catch { /* 忽略单条解析失败 */ }
      }
    }
    if (urlFound) {
      console.log(`[imageApi] 同步生图成功 url=`, urlFound)
      return { ok: true, url: urlFound }
    }
    console.error(`[imageApi] 同步流读完但未取到图片`)
    return { ok: false, error: '上游未返回图片' }
  } catch (e) {
    console.error(`[imageApi] 同步响应解析失败:`, e.message)
    return { ok: false, error: `响应解析失败：${e.message}` }
  }
}

/** 异步模式：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed */
async function generateAsync({ provider, url, genBody }, onProgress) {
  let res
  try {
    res = await proxyRequest({ provider, url, method: 'POST', body: genBody })
  } catch (e) {
    return { ok: false, error: `网络错误：${e.message}` }
  }
  if (!res.ok) {
    const msg = await readError(res)
    console.error(`[imageApi] 异步提交失败 status=${res.status} msg=`, msg)
    return { ok: false, error: msg }
  }

  let json
  try { json = await res.json() } catch {
    console.error(`[imageApi] 异步提交响应解析失败 (HTTP ${res.status})`)
    return { ok: false, error: `响应解析失败 (HTTP ${res.status})` }
  }
  console.log(`[imageApi] 异步提交响应 json=`, JSON.stringify(json).slice(0, 400))
  const data = json?.data ?? json
  const tasks = Array.isArray(data) ? data : (Array.isArray(json) ? json : [])
  const submitted = tasks.find((t) => t && (t.status === 'submitted' || t.task_id))
  const taskId = submitted?.task_id
  if (!taskId) {
    // 供应商可能直接同步返回结果（非异步任务形态），兼容取 url
    const direct = data?.results?.[0]?.url || data?.result?.images?.[0]?.url || json?.results?.[0]?.url
    if (direct) {
      console.log(`[imageApi] 提交即返回结果 url=`, direct)
      return { ok: true, url: direct }
    }
    console.error(`[imageApi] 异步提交未拿到 task_id, json=`, JSON.stringify(json).slice(0, 300))
    return { ok: false, error: `上游未返回任务 id：${JSON.stringify(json).slice(0, 200)}` }
  }

  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  console.log(`[imageApi] 异步提交成功，task_id=${taskId}，开始轮询 pollUrl=`, pollUrl)
  const start = Date.now()
  const timeoutMs = 300000 // 5min 上限
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000))
    let pr
    try {
      pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' })
    } catch (e) {
      return { ok: false, error: `轮询网络错误：${e.message}` }
    }
    if (!pr.ok) {
      // 任务查询 404 = 任务不存在/已清理，给一次重试后放弃
      if (pr.status === 404) return { ok: false, error: await readError(pr) }
      console.error(`[imageApi] 轮询 status=${pr.status} 非 404，重试`)
      continue
    }
    let pj
    try { pj = await pr.json() } catch { console.error(`[imageApi] 轮询响应解析失败, status=${pr.status}`); continue }
    console.log(`[imageApi] 轮询响应 json=`, JSON.stringify(pj).slice(0, 400))
    const pd = pj?.data ?? pj
    const status = pd?.status || pd?.state
    const imgUrl = pd?.result?.images?.[0]?.url || pd?.results?.[0]?.url
    if (imgUrl) {
      console.log(`[imageApi] 异步轮询拿到图片 url=`, imgUrl)
      return { ok: true, url: imgUrl }
    }
    if (status === 'failed' || status === 'error') {
      console.error(`[imageApi] 上游任务失败 status=`, status, 'detail=', JSON.stringify(pd).slice(0, 300))
      return { ok: false, error: pd?.error?.message || pd?.error || '上游任务失败' }
    }
    // 简易进度：无精确百分比时按轮询次数递增
    if (onProgress) onProgress(Math.min(90, Math.round((Date.now() - start) / 3000) * 10))
    console.log(`[imageApi] 轮询中… status=${status || 'processing'}`)
  }
  return { ok: false, error: '轮询超时（5 分钟）' }
}

/**
 * @param {object} opts
 *   - provider, prompt, model, size, n, aspectRatio
 *   - images?: string[]  参考图 URL 数组（图生图）。网关经 body.image_urls 接收，
 *                        能处理 http(s)/data: base64/裸 base64，自动转 CDN（见
 *                        apimart-gateway/main.py resolve_attachments）。
 *                        只有 blob: 是例外——它是浏览器内临时地址，网关进程访问不到会丢弃，
 *                        故本函数先把 blob: 转成 data: base64 再发，保证任何参考图都能发出去。
 * @param {function} [onProgress] 进度回调 (percent)
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateImage({ provider, prompt, model, size, n, aspectRatio, images }, onProgress) {
  // 网关契约（apimart-gateway/README.md §文生图/图生图）：
  //   size 接受「比例(如 1:1)」或「精确像素(如 1024x1024)」；resolution 接受清晰度档位(如 1K/2K)。
  //   网关 parse_size(size, resolution) 会把「比例×档位」换算成固定像素锁定输出。
  //   ⚠️ 别用下划线 aspect_ratio——网关只认驼峰 aspectRatio（且只在没传 size 时才当 size 用）。
  //   因此这里把比例放 size、档位放 resolution，两个都传才能让比例+清晰度同时生效。
  const genBody = { prompt, model, n: n || 1 }
  const hasRatio = aspectRatio && aspectRatio !== 'Auto'
  genBody.size = hasRatio ? aspectRatio : (size || '')
  if (size && hasRatio) genBody.resolution = size // 有比例时把 1K/2K 档位放 resolution
  // 参考图（图生图）：网关 /v1/images/generations 认 image_urls 字段。
  // 公共工具统一处理 blob:→data base64，其余形式（http/data/裸base64）原样交给网关。
  const refImages = await resolveRefImages(images)
  if (refImages.length > 0) genBody.image_urls = refImages
  const url = buildTargetUrl(provider, 'images/generations')
  const mode = provider?.image_mode === 'async' ? 'async' : 'sync'
  console.log(`[imageApi] 模式=${mode} 供应商=${provider?.id || '(默认)'} 参考图=${refImages.length} size=${genBody.size} resolution=${genBody.resolution || ''}`)
  return mode === 'async'
    ? generateAsync({ provider, url, genBody }, onProgress)
    : generateSync({ provider, url, genBody }, onProgress)
}
