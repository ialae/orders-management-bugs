const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TIMEOUT_MS = 30000

function signalWithTimeout(externalSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => {
      clearTimeout(timer)
      controller.abort()
    }, { once: true })
  }
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) }
}

async function request(path, options = {}) {
  const { signal: timeoutSignal, cleanup } = signalWithTimeout(options.signal)
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    signal: timeoutSignal,
  })
  cleanup()

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // response had no JSON body
    }
    throw new Error(detail)
  }

  if (res.status === 204) return null
  return res.json()
}

function toQueryString(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })
  const str = query.toString()
  return str ? `?${str}` : ''
}

export const clientsApi = {
  list: (params, options) => request(`/api/clients${toQueryString(params)}`, options),
  options: () => request('/api/clients/options'),
  get: (id) => request(`/api/clients/${id}`),
  create: (data) => request('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/clients/${id}`, { method: 'DELETE' }),
}

export const ordersApi = {
  list: (params) => request(`/api/orders${toQueryString(params)}`),
  get: (id) => request(`/api/orders/${id}`),
  create: (data) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),
}
