import request from './index'

export const capabilities = () => request.get('/demand-api/capabilities')
export const listForms = () => request.get('/demand-api/forms')
export const formInfo = (key) => request.get(`/demand-api/forms/${encodeURIComponent(key)}`)
export const listRequests = (params) => request.get('/demand-api/requests', { params })
export const requestSummary = (params) => request.get('/demand-api/requests/summary', { params })
export const requestDetail = (id) => request.get(`/demand-api/requests/${id}`)
export const lookup = (data) => request.post('/demand-api/lookup', data, { skipAuthentication: true })
export const assign = (id, data, config) => request.post(`/demand-api/requests/${id}/assign`, data, config)
export const outcome = (id, data, config) => request.post(`/demand-api/requests/${id}/outcome`, data, config)
export const message = (id, data, config) => request.post(`/demand-api/requests/${id}/messages`, data, config)
export const markRead = (data) => request.post('/demand-api/read', data)
export const publications = () => request.get('/demand-api/publications')
export const publicationDetail = (id) => request.get(`/demand-api/publications/${id}`)
export const publish = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/publication`, data, config)
export const skipPublication = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/publication/skip`, data, config)
export const autoPublish = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/publication/auto`, data, config)
export const handlers = (key) => request.get(`/demand-api/forms/${encodeURIComponent(key)}/handlers`)
export const exportRequests = (params) =>
  request.get('/demand-api/export/requests', {
    params,
    responseType: 'blob',
    timeout: 120000,
    silent: true
  })
export const exportPublications = (params) =>
  request.get('/demand-api/export/publications', {
    params,
    responseType: 'blob',
    timeout: 120000,
    silent: true
  })
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
