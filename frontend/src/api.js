const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) {
        if (Array.isArray(body.detail)) {
          detail = body.detail.map(err => err.msg).join(', ')
        } else {
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        }

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
  list: (params) => request(`/api/clients${toQueryString(params)}`),
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
