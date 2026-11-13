import Vue from 'vue'
import { capabilities } from '@/api/demand'

export const demandState = Vue.observable({
  enabled: false,
  admin: false,
  handler: false,
  mineUnread: 0,
  pending: 0,
  publicationUnread: 0
})
export async function refreshDemand() {
  const response = await capabilities()
  Object.assign(
    demandState,
    { mineUnread: 0, pending: 0, publicationUnread: 0, admin: false, handler: false },
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
