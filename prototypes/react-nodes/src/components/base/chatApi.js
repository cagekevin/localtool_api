/**
 * 文本聊天 API（经 localTool /api/proxy 转发 → 供应商，多 provider 通用）。
 * TextNode → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/chat/completions
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://chat/completions，localTool 拼 base+key
 * /api/proxy 请求体：{ url, providerId, method, body }，body=JSON字符串 { model, messages, stream:false }
 *
 * 参考图（images）：
 *  - 文本节点连了上游图时，要让 AI「看图反推提示词/理解图片」，参考图必须随聊天一起发。
 *  - 网关 chat 契约：user message 的 content 为数组时支持 { type:'image_url', image_url:{url} }，
 *    网关提取后经 resolve_attachments 处理（见 apimart-gateway/main.py chat_completions）。
 *  - 参考图 url 经 refImage.js 统一解析（blob:→data base64，其余原样交给网关）。
 */
import { resolveRefImages, toImageContentBlocks } from './refImage.js'
const API_BASE = 'http://127.0.0.1:18080'

function buildTargetUrl(provider) {
  const proto = provider?.protocol || 'apimart'
  if (proto === 'openai') return 'openai://chat/completions'
  const base = (provider?.base_url || '').replace(/\/$/, '')
  return `${base}/v1/chat/completions`
}

/**
 * @param {object} opts
 *   - provider, messages, model
 *   - images?: string[]  参考图 URL 数组（可选）。连线上游的图传这里，AI 才能看到图片。
 * @returns {{ ok:boolean, content?:string, error?:string }}
 */
export async function chatCompletions({ provider, messages, model, images }) {
  // 参考图：解析（blob→data）后以 image_url 内容块附加到最后一条 user 消息的 content 里。
  let finalMessages = messages
  if (images && images.length > 0) {
    const refUrls = await resolveRefImages(images)
    if (refUrls.length > 0) {
      const blocks = toImageContentBlocks(refUrls)
      const userIdx = finalMessages.length - 1
      const last = finalMessages[userIdx] || {}
      const contentArr = Array.isArray(last.content)
        ? [...last.content]
        : [{ type: 'text', text: typeof last.content === 'string' ? last.content : String(last.content || '') }]
      contentArr.push(...blocks)
      const patched = finalMessages.map((m, i) => (i === userIdx ? { ...m, content: contentArr } : m))
      finalMessages = patched
      console.log(`[chatApi] 附加 ${refUrls.length} 张参考图到 user 消息`)
    }
  }

  const payload = {
    url: buildTargetUrl(provider),
    method: 'POST',
    body: JSON.stringify({ model, messages: finalMessages, temperature: 0.1, stream: false }),
  }
  if (provider?.id) payload.providerId = provider.id
  console.log('[chatApi] 入参 provider=', provider, 'model=', model)
  console.log('[chatApi] 请求 payload=', JSON.stringify(payload))

  let res
  try {
    res = await fetch(`${API_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    console.log('[chatApi] fetch 完成, status=', res.status)
  } catch (e) {
    console.error('[chatApi] fetch 异常:', e.message)
    return { ok: false, error: `网络错误：${e.message}` }
  }

  let json
  try {
    json = await res.json()
    console.log('[chatApi] 响应 json=', JSON.stringify(json).slice(0, 300))
  } catch {
    console.error('[chatApi] 响应解析失败, status=', res.status)
    return { ok: false, error: `响应解析失败 (HTTP ${res.status})` }
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || json?.detail || `HTTP ${res.status}`
    return { ok: false, error: msg }
  }

  const data = json?.data ?? json
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim()) {
    return { ok: true, content }
  }
  return { ok: false, error: '上游未返回文本内容' }
}
