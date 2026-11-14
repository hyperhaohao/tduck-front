import request from './index'

export const capabilities = () => request.get('/demand-api/capabilities')
export const listForms = () => request.get('/demand-api/forms')
export const formInfo = (key) => request.get(`/demand-api/forms/${encodeURIComponent(key)}`)
export const listRequests = (params) => request.get('/demand-api/requests', { params })
export const requestSummary = (params) => request.get('/demand-api/requests/summary', { params })
export const requestDetail = (id) => request.get(`/demand-api/requests/${id}`)
export const lookup = (data) => request.post('/demand-api/lookup', data, { skipAuthentication: true })
export const assign = (id, data) => request.post(`/demand-api/requests/${id}/assign`, data)
export const outcome = (id, data) => request.post(`/demand-api/requests/${id}/outcome`, data)
export const message = (id, data) => request.post(`/demand-api/requests/${id}/messages`, data)
export const markRead = (data) => request.post('/demand-api/read', data)
export const publications = () => request.get('/demand-api/publications')
export const publicationDetail = (id) => request.get(`/demand-api/publications/${id}`)
export const publish = (id, data) => request.post(`/demand-api/requests/${id}/publication`, data)
export const adminForms = () => request.get('/demand-api/admin/forms')
export const configureForm = (key, data) => request.post(`/demand-api/admin/forms/${key}`, data)
export const members = (key) => request.get(`/demand-api/admin/forms/${key}/members`)
export const saveMember = (key, id, data) => request.post(`/demand-api/admin/forms/${key}/members/${id}`, data)
export const users = (keyword = '') => request.get('/demand-api/admin/users', { params: { keyword } })
export const admins = () => request.get('/demand-api/admin/roles')
export const saveAdmin = (id, grant) => request.post(`/demand-api/admin/roles/${id}`, { grant })
export const startLogin = (returnPath) => request.get('/auth/oidc/start', { params: { returnPath } })
export const exchangeLogin = (ticket) => request.post('/auth/oidc/exchange', { ticket })
export const downloadAttachment = (id, data) =>
  request.post(`/demand-api/requests/${id}/attachment`, data, {
    responseType: 'blob',
    skipAuthentication: !!data.queryCode
  })
