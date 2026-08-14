/**
 * 视频生成 API（经 localTool /api/proxy → 供应商，多 provider 通用）。
 * DiscountVideoNode → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/videos/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://videos/generations，localTool 拼 base+key
 *
 * ⚠️ 视频强制异步（不同于生图）：视频生成很慢，不适合 SSE 同步等待。
 * 统一走「提交返回 task_id → 轮询 GET /v1/tasks/{id} 到 completed → 取 result.videos[].url」。
 * 不走 provider.image_mode，也不用 sync（generateSync 已删除）。
 * localTool 不再强制注入 wait，只按前端请求透传。
 *
 * 网关契约（apimart-gateway/README.md §文生视频）：
 *  - body：{ model, prompt, size(如 16:9), image_urls(参考图可选) }
 *  - 参考图经 refImage.js 统一解析（blob:→data base64，其余原样交给网关）。
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
  console.log(`[videoApi] ${method} 请求 payload=`, JSON.stringify(payload))
  let res
  try {
    res = await fetch(`${API_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error(`[videoApi] ${method} fetch 异常:`, e.message)
    throw e
  }
  console.log(`[videoApi] ${method} 响应 status=`, res.status, 'url=', url)
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

/** 异步模式（视频唯一模式）：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed */
async function generateAsync({ provider, url, genBody }, onProgress) {
  let res
  try {
    res = await proxyRequest({ provider, url, method: 'POST', body: genBody })
  } catch (e) {
    return { ok: false, error: `网络错误：${e.message}` }
  }
  if (!res.ok) {
    const msg = await readError(res)
    console.error(`[videoApi] 异步提交失败 status=${res.status} msg=`, msg)
    return { ok: false, error: msg }
  }

  let json
  try { json = await res.json() } catch {
    console.error(`[videoApi] 异步提交响应解析失败 (HTTP ${res.status})`)
    return { ok: false, error: `响应解析失败 (HTTP ${res.status})` }
  }
  console.log(`[videoApi] 异步提交响应 json=`, JSON.stringify(json).slice(0, 400))
  const data = json?.data ?? json
  const tasks = Array.isArray(data) ? data : (Array.isArray(json) ? json : [])
  const submitted = tasks.find((t) => t && (t.status === 'submitted' || t.task_id))
  const taskId = submitted?.task_id
  if (!taskId) {
    // 供应商可能直接同步返回结果（非异步任务形态），兼容取 url
    const direct = data?.result?.videos?.[0]?.url || data?.results?.[0]?.url || json?.result?.videos?.[0]?.url
    if (direct) {
      console.log(`[videoApi] 提交即返回结果 url=`, direct)
      return { ok: true, url: direct }
    }
    console.error(`[videoApi] 异步提交未拿到 task_id, json=`, JSON.stringify(json).slice(0, 300))
    return { ok: false, error: `上游未返回任务 id：${JSON.stringify(json).slice(0, 200)}` }
  }

  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  console.log(`[videoApi] 异步提交成功，task_id=${taskId}，开始轮询 pollUrl=`, pollUrl)
  const start = Date.now()
  const timeoutMs = 600000 // 视频生成更久，10min 上限
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 5000))
    let pr
    try {
      pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' })
    } catch (e) {
      return { ok: false, error: `轮询网络错误：${e.message}` }
    }
    if (!pr.ok) {
      if (pr.status === 404) return { ok: false, error: await readError(pr) }
      console.error(`[videoApi] 轮询 status=${pr.status} 非 404，重试`)
      continue
    }
    let pj
    try { pj = await pr.json() } catch { console.error(`[videoApi] 轮询响应解析失败, status=${pr.status}`); continue }
    console.log(`[videoApi] 轮询响应 json=`, JSON.stringify(pj).slice(0, 400))
    const pd = pj?.data ?? pj
    const status = pd?.status || pd?.state
    const vidUrl = pd?.result?.videos?.[0]?.url || pd?.result?.images?.[0]?.url || pd?.results?.[0]?.url
    if (vidUrl) {
      console.log(`[videoApi] 异步轮询拿到视频 url=`, vidUrl)
      return { ok: true, url: vidUrl }
    }
    if (status === 'failed' || status === 'error') {
      console.error(`[videoApi] 上游任务失败 status=`, status, 'detail=', JSON.stringify(pd).slice(0, 300))
      return { ok: false, error: pd?.error?.message || pd?.error || '上游任务失败' }
    }
    if (onProgress) onProgress(Math.min(90, Math.round((Date.now() - start) / 5000) * 10))
    console.log(`[videoApi] 轮询中… status=${status || 'processing'}`)
  }
  return { ok: false, error: '轮询超时（10 分钟）' }
}

/**
 * @param {object} opts
 *   - provider, prompt, model
 *   - size: 比例（如 '16:9'）
 *   - resolution: 清晰度（如 '1080p'）
 *   - seconds: 时长（秒）
 *   - images?: string[] 参考图 URL 数组（图生视频，可选）。网关经 body.image_urls 接收，
 *                        支持 http/data/裸base64，blob: 由 refImage.js 先转 data base64。
 * @param {function} [onProgress] 进度回调 (percent)
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateVideo({ provider, prompt, model, size, resolution, seconds, images }, onProgress) {
  const genBody = { prompt, model }
  if (size && size !== 'Auto') genBody.size = size
  if (resolution) genBody.resolution = resolution
  if (seconds) genBody.duration = String(seconds)
  // 参考图（图生视频）：网关 /v1/videos/generations 认 image_urls 字段
  const refImages = await resolveRefImages(images)
  if (refImages.length > 0) genBody.image_urls = refImages

  const url = buildTargetUrl(provider, 'videos/generations')
  // 视频强制异步（很慢，不用同步 SSE 等待），不受 provider.image_mode 影响
  console.log(`[videoApi] 模式=async(视频强制异步) 供应商=${provider?.id || '(默认)'} 参考图=${refImages.length} size=${genBody.size} res=${genBody.resolution || ''} duration=${genBody.duration || ''}`)
  return generateAsync({ provider, url, genBody }, onProgress)
}
