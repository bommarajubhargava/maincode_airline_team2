async function fetcher(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const shiftService = {
  getMyShifts:    (days = 30) => fetcher(`/api/shifts/my?days=${days}`),
  getAllShifts:    ()          => fetcher('/api/shifts/all'),
  getMyRequests:  ()          => fetcher('/api/shifts/requests/my'),
  getAllRequests:  ()          => fetcher('/api/shifts/requests'),
  getUsers:       ()          => fetcher('/api/users'),

  submitRequest: (dto) =>
    fetcher('/api/shifts/request', { method: 'POST', body: JSON.stringify(dto) }),

  deleteRequest: (id) =>
    fetcher(`/api/shifts/requests/${id}`, { method: 'DELETE' }),

  approveRequest: (id, comment = '') =>
    fetcher(`/api/shifts/requests/${id}/approve`, { method: 'PUT', body: JSON.stringify({ managerComment: comment }) }),

  rejectRequest: (id, comment = '') =>
    fetcher(`/api/shifts/requests/${id}/reject`, { method: 'PUT', body: JSON.stringify({ managerComment: comment }) }),

  updateShift: (id, dto) =>
    fetcher(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
}

export const complianceService = {
  getReport:    ()       => fetcher('/api/shifts/compliance'),
  getUserReport: (userId) => fetcher(`/api/shifts/compliance/${userId}`),
}
