/**
 * localTool API 封装（供应商管理）。
 * 数据层唯一发请求的地方；store/组件不直接 fetch。
 */
const API_BASE = 'http://127.0.0.1:18080'

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || data.error || `HTTP ${res.status}`)
  }
  return data
}

export const providerApi = {
  getProviders: () => request('/api/providers'),
  saveProviders: (providers) => request('/api/providers', { method: 'PUT', body: { providers } }),
  testConnection: (payload) => request('/api/providers/test-connection', { method: 'POST', body: payload }),
  fetchModels: (id) => request(`/api/providers/${encodeURIComponent(id)}/fetch-models`, { method: 'POST' }),
}
