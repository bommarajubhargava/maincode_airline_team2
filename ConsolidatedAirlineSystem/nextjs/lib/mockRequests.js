if (!global._requests) {
  global._requests = []
  global._reqCounter = 1
}

export const getRequests = () => global._requests

export const addRequest = (data) => {
  const req = {
    ...data,
    id: `req-${String(global._reqCounter++).padStart(4, '0')}`,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    managerComment: null,
  }
  global._requests.unshift(req)
  return req
}

export const findRequestById = (id) =>
  global._requests.find(r => r.id === id)

export const updateRequest = (id, updates) => {
  const idx = global._requests.findIndex(r => r.id === id)
  if (idx === -1) return null
  global._requests[idx] = { ...global._requests[idx], ...updates }
  return global._requests[idx]
}
