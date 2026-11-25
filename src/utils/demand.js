import Vue from 'vue'
import { capabilities } from '@/api/demand'

export const demandState = Vue.observable({
  enabled: false,
  admin: false,
  documentAccess: false,
  formManage: false,
  org: false,
  userManage: false,
  permissionApi: false,
  granted: [],
  global: false,
  handler: false,
  manage: false,
  mineUnread: 0,
  pending: 0,
  publicationUnread: 0,
  noticeUnread: 0,
  approvalPending: 0,
  approver: false
})
export async function refreshDemand() {
  const response = await capabilities()
  const data = response.data || {}
  // 旧后端没有新字段时回退到原 admin 语义，保证前端可先行部署。
  const documentAccess =
    data.documentAccess === undefined ? !!data.admin : !!data.documentAccess
  const formManage = data.formManage === undefined ? documentAccess : !!data.formManage
  const org = data.org === undefined ? documentAccess : !!data.org
  Object.assign(demandState, {
    enabled: !!data.enabled,
    admin: documentAccess,
    documentAccess,
    formManage,
    org,
    userManage: !!data.userManage,
    permissionApi: !!data.permissionApi,
    granted: Array.isArray(data.granted) ? data.granted : [],
    global: !!data.global,
    handler: !!data.handler,
    manage: !!data.manage,
    mineUnread: data.mineUnread || 0,
    pending: data.pending || 0,
    publicationUnread: data.publicationUnread || 0,
    noticeUnread: data.noticeUnread || 0,
    approvalPending: data.approvalPending || 0,
    approver: !!data.approver
  })
  return demandState
}
export const decisions = { PENDING: '待评估', ACCEPTED: '采纳', DEFERRED: '暂缓', REJECTED: '不采纳' }
export const outcomeDecisions = { ACCEPTED: '采纳', DEFERRED: '暂缓', REJECTED: '不采纳' }
export const progresses = { NONE: '—', PLANNED: '待实施', IN_PROGRESS: '实施中', COMPLETED: '已完成' }
export const badgeValue = (value) => Math.max(0, Number(value) || 0)
export function safeLocalPath(path, fallback = '/demand/home') {
  return typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/[\\\r\n]/.test(path) &&
    !/%2f|%5c/i.test(path)
    ? path
    : fallback
}

export const implementationProgresses = { PLANNED: '待实施', IN_PROGRESS: '实施中', COMPLETED: '已完成' }

/** 解析导出响应；服务端返回 JSON 错误时给出具体提示。 */
export async function resolveXlsxBlob(response) {
  const blob = response instanceof Blob ? response : response && response.data
  if (!(blob instanceof Blob)) throw new Error('导出失败，请稍后重试')
  if ((blob.type || '').includes('json')) {
    let message = '导出失败，请稍后重试'
    try {
      const body = JSON.parse(await blob.text())
      if (body && body.msg) message = body.msg
    } catch (e) {
      /* 非标准错误体使用默认提示。 */
    }
    throw new Error(message)
  }
  return blob
}

/** 导出文件名时间戳，精确到分钟。 */
export function exportStamp() {
  const d = new Date()
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
