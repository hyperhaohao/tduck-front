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
export const followUp = (id, data, config) => request.post(`/demand-api/requests/${id}/followup`, data, config)
export const deleteRequest = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/delete`, data, config)
export const markRead = (data) => request.post('/demand-api/read', data)
export const publications = (includeArchived) =>
  request.get('/demand-api/publications', { params: { includeArchived: includeArchived ? 1 : 0 } })
export const publicationDetail = (id) => request.get(`/demand-api/publications/${id}`)
export const publish = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/publication`, data, config)
export const skipPublication = (id, data, config) =>
  request.post(`/demand-api/requests/${id}/publication/skip`, data, config)
export const archivePublication = (id, data, config) =>
  request.post(`/demand-api/publications/${id}/archive`, data, config)
export const deletePublication = (id, data, config) =>
  request.post(`/demand-api/publications/${id}/delete`, data, config)
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
export const sortForms = (formKeys) =>
  request.post('/demand-api/admin/forms/sort', { formKeys })
export const deletedForms = () => request.get('/demand-api/admin/forms/deleted')
export const deleteCollection = (key) =>
  request.post(`/demand-api/admin/forms/${encodeURIComponent(key)}/delete`)
export const restoreCollection = (key) =>
  request.post(`/demand-api/admin/forms/${encodeURIComponent(key)}/restore`)
export const purgeCollection = (key) =>
  request.post(`/demand-api/admin/forms/${encodeURIComponent(key)}/purge`)
export const configureForm = (key, data) => request.post(`/demand-api/admin/forms/${key}`, data)
export const voidForm = (key, data) => request.post(`/demand-api/admin/forms/${key}/void`, data)
export const members = (key) => request.get(`/demand-api/admin/forms/${key}/members`)
export const saveMember = (key, id, data) => request.post(`/demand-api/admin/forms/${key}/members/${id}`, data)
export const removeMember = (key, id) => request.delete(`/demand-api/admin/forms/${key}/members/${id}`)
export const departments = () => request.get('/demand-api/admin/departments')
export const departmentRoster = () => request.get('/demand-api/admin/departments/members')
export const createDepartment = (data) => request.post('/demand-api/admin/departments', data)
export const updateDepartment = (deptKey, data) =>
  request.put(`/demand-api/admin/departments/${encodeURIComponent(deptKey)}`, data)
export const removeDepartment = (deptKey) =>
  request.delete(`/demand-api/admin/departments/${encodeURIComponent(deptKey)}`)
export const addOrgMember = (deptKey, userId) =>
  request.post(
    `/demand-api/admin/departments/${encodeURIComponent(deptKey)}/members/${encodeURIComponent(userId)}`
  )
export const removeOrgMember = (deptKey, userId) =>
  request.delete(
    `/demand-api/admin/departments/${encodeURIComponent(deptKey)}/members/${encodeURIComponent(userId)}`
  )
export const setUserDepartments = (userId, deptKeys) =>
  request.put(`/demand-api/admin/users/${encodeURIComponent(userId)}/departments`, { deptKeys })
export const departmentMembers = (key) => request.get(`/demand-api/admin/forms/${key}/department-members`)
export const saveDepartmentMember = (key, deptKey, data) =>
  request.post(`/demand-api/admin/forms/${key}/department-members/${encodeURIComponent(deptKey)}`, data)
export const removeDepartmentMember = (key, deptKey) =>
  request.delete(`/demand-api/admin/forms/${key}/department-members/${encodeURIComponent(deptKey)}`)
export const importDepartments = (data) => request.post('/demand-api/admin/departments/import', data)
export const users = (keyword = '') => request.get('/demand-api/admin/users', { params: { keyword } })
export const admins = () => request.get('/demand-api/admin/roles')
export const saveAdmin = (id, grant) => request.post(`/demand-api/admin/roles/${id}`, { grant })
export const permissionMatrix = () => request.get('/demand-api/admin/permissions')
export const savePermissions = (id, capabilities) =>
  request.post(`/demand-api/admin/permissions/${id}`, { capabilities })
export const startLogin = (returnPath) => request.get('/auth/oidc/start', { params: { returnPath } })
export const exchangeLogin = (ticket) => request.post('/auth/oidc/exchange', { ticket })
export const downloadAttachment = (id, data) =>
  request.post(`/demand-api/requests/${id}/attachment`, data, {
    responseType: 'blob',
    skipAuthentication: !!data.queryCode
  })
export const notices = (params) => request.get('/demand-api/notices', { params })
export const readNotice = (id) => request.post(`/demand-api/notices/${id}/read`)
export const readAllNotices = () => request.post('/demand-api/notices/read-all')
export const requiredMembers = (key) =>
  request.get(`/demand-api/admin/forms/${encodeURIComponent(key)}/required-members`)
export const saveRequiredMembers = (key, data) =>
  request.post(`/demand-api/admin/forms/${encodeURIComponent(key)}/required-members`, data)
export const nextRound = (key, data) =>
  request.post(`/demand-api/admin/forms/${encodeURIComponent(key)}/round/next`, data)
export const decideApproval = (id, data) =>
  request.post(`/demand-api/requests/${id}/approval`, data)
