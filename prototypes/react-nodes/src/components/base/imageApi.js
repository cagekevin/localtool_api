/**
 * 生图 API —— 经 localTool /api/proxy 转发到供应商的 /v1/images/generations。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/images/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://images/generations，localTool 拼 base+key
 *
 * 同步/异步由 provider.image_mode 决定（API 设置页「图片生成模式」）：
 *  - sync ：URL 带 ?wait=1 → 网关同步 SSE 返回（progress + status:succeeded + results[].url）
 *  - async：提交返回 [{status:"submitted", task_id}] → 轮询 GET /v1/tasks/{id} 到 completed
 */
import { resolveRefImages } from './refImage.js'

const API_BASE = 'http://127.0.0.1:18080'

/** 目标端点：openai 用伪协议；apimart 用 base_url + /v1/{path}。 */
function buildTargetUrl(provider, path) {
  if ((provider?.protocol || 'apimart') === 'openai') return `openai://${path}`
  return `${(provider?.base_url || '').replace(/\/$/, '')}/v1/${path}`
}

/** 统一响应信封：成功 {ok:true, url}，失败 {ok:false, error}。 */
function ok(url) { return { ok: true, url } }
function fail(error) { return { ok: false, error } }

/** 经 localTool /api/proxy 转发（GET/POST）。失败抛错由调用方兜底。 */
async function proxyRequest({ provider, url, method = 'POST', body }) {
  const payload = { url, method }
  if (body) payload.body = JSON.stringify(body)
  if (provider?.id) payload.providerId = provider.id
  const res = await fetch(`${API_BASE}/api/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error?.message || j?.message || j?.detail || `HTTP ${res.status}`)
  }
  return res
}

/** 从 SSE 响应流中提取第一个成功图片 url（兼容 {results[].url} 与 {result.images[].url}）。 */
async function readSseImageUrl(res, onProgress) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let urlFound = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const raw = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : ''
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          if (typeof evt.progress === 'number') onProgress?.(evt.progress)
          const imgUrl = evt?.results?.[0]?.url || evt?.result?.images?.[0]?.url
          if (evt.status === 'succeeded' && imgUrl) urlFound = imgUrl
          if (evt.status === 'failed' || evt.error) throw new Error(evt.error || evt.failure_reason || '生成失败')
        } catch (e) { /* 忽略单条 JSON 解析失败 */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return urlFound
}

/** 同步模式：URL 带 ?wait=1，读 SSE 流拿图片 url。 */
async function generateSync({ provider, url, genBody }, onProgress) {
  let waitUrl = url
  try {
    const u = new URL(url)
    u.searchParams.set('wait', '1')
    waitUrl = u.toString()
  } catch { /* 解析失败则原样 */ }

  try {
    const res = await proxyRequest({ provider, url: waitUrl, method: 'POST', body: genBody })
    const imgUrl = await readSseImageUrl(res, onProgress)
    return imgUrl ? ok(imgUrl) : fail('上游未返回图片')
  } catch (e) {
    return /^网络错误/.test(e?.message || '') ? fail(e.message) : fail(`生图失败：${e?.message || '同步请求异常'}`)
  }
}

/** 异步模式：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed。 */
async function generateAsync({ provider, url, genBody, timeoutMs }, onProgress) {
  // 提交
  let taskId
  try {
    const res = await proxyRequest({ provider, url, method: 'POST', body: genBody })
    const json = await res.json()
    const data = json?.data ?? json
    const tasks = Array.isArray(data) ? data : (Array.isArray(json) ? json : [])
    const submitted = tasks.find((t) => t && (t.status === 'submitted' || t.task_id))
    taskId = submitted?.task_id
    // 部分供应商提交即返回结果（非任务形态）
    const direct = data?.results?.[0]?.url || data?.result?.images?.[0]?.url || json?.results?.[0]?.url
    if (!taskId && direct) return ok(direct)
  } catch (e) {
    return /^网络错误/.test(e?.message || '') ? fail(e.message) : fail(`提交失败：${e?.message || '提交异常'}`)
  }
  if (!taskId) return fail(`上游未返回任务 id`)

  // 轮询
  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' })
      const pj = await pr.json()
      const pd = pj?.data ?? pj
      const imgUrl = pd?.result?.images?.[0]?.url || pd?.results?.[0]?.url
      if (imgUrl) return ok(imgUrl)
      if (pd?.status === 'failed' || pd?.status === 'error') {
        return fail(pd?.error?.message || pd?.error || '上游任务失败')
      }
      onProgress?.(Math.min(90, Math.round((Date.now() - start) / 3000) * 10))
    } catch (e) {
      return fail(`轮询失败：${e?.message || '轮询异常'}`)
    }
  }
  return fail('轮询超时')
}

/**
 * 生图（文生图 / 图生图）。
 * 网关契约：size 接受「比例(如 1:1)」或「精确像素」；resolution 接受清晰度档位(如 1K/2K)。
 * 网关只认驼峰 aspectRatio（无 size 时才当 size 用）→ 这里比例放 size、档位放 resolution。
 * 参考图（图生图）：网关 /v1/images/generations 认 image_urls 字段，blob: 由 refImage 先转 data base64。
 * @param {object} opts
 *   - provider, prompt, model, size, n, aspectRatio
 *   - images?: string[]
 * @param {function} [onProgress] (percent)
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateImage({ provider, prompt, model, size, n, aspectRatio, images }, onProgress) {
  const genBody = { prompt, model, n: n || 1 }
  const hasRatio = aspectRatio && aspectRatio !== 'Auto'
  genBody.size = hasRatio ? aspectRatio : (size || '')
  if (size && hasRatio) genBody.resolution = size
  const refImages = await resolveRefImages(images)
  if (refImages.length > 0) genBody.image_urls = refImages

  const url = buildTargetUrl(provider, 'images/generations')
  const mode = provider?.image_mode === 'async' ? 'async' : 'sync'
  return mode === 'async'
    ? generateAsync({ provider, url, genBody, timeoutMs: 300000 }, onProgress)
    : generateSync({ provider, url, genBody }, onProgress)
}
