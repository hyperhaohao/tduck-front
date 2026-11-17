import Vue from 'vue'
import { capabilities } from '@/api/demand'

export const demandState = Vue.observable({
  enabled: false,
  admin: false,
  global: false,
  handler: false,
  manage: false,
  mineUnread: 0,
  pending: 0,
  publicationUnread: 0
})
export async function refreshDemand() {
  const response = await capabilities()
  Object.assign(
    demandState,
    {
      mineUnread: 0,
      pending: 0,
      publicationUnread: 0,
      admin: false,
      global: false,
      handler: false,
      manage: false
    },
    response.data
  )
  return demandState
}
export const decisions = { PENDING: '待评估', ACCEPTED: '采纳', DEFERRED: '暂缓', REJECTED: '不采纳' }
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
