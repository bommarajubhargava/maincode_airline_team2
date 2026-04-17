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

export const schedulingService = {
  getTemplates:  ()                     => fetcher('/api/scheduling/templates'),
  getRosters:    ()                     => fetcher('/api/scheduling/roster'),
  getRoster:     (id)                   => fetcher(`/api/scheduling/roster/${id}`),
  preview:       (startDate, endDate)   => fetcher('/api/scheduling/roster', { method: 'POST', body: JSON.stringify({ startDate, endDate, preview: true }) }),
  saveDraft:     (name, startDate, endDate) => fetcher('/api/scheduling/roster', { method: 'POST', body: JSON.stringify({ name, startDate, endDate, preview: false }) }),
  publish:       (id, force = false)    => fetcher(`/api/scheduling/roster/${id}/publish`, { method: 'POST', body: JSON.stringify({ force }) }),
  deleteRoster:  (id)                   => fetcher(`/api/scheduling/roster/${id}`, { method: 'DELETE' }),
}
