const STORAGE_KEY = 'ruima.ai.plans'
const MAX_PLANS = 20

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // 存储空间不足时忽略，保留当前会话中的方案
  }
}

function scopeKey(scope) {
  return scope || 'create'
}

export function listPlans(scope) {
  const data = readAll()
  const list = data[scopeKey(scope)]
  return Array.isArray(list) ? list.slice() : []
}

/**
 * 保存或更新方案。返回带 planId、savedAt、status 的条目。
 */
export function savePlan(scope, plan) {
  const key = scopeKey(scope)
  const data = readAll()
  const list = Array.isArray(data[key]) ? data[key] : []
  const planId = plan.planId || `plan-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const entry = {
    ...plan,
    planId,
    status: plan.status || 'draft',
    savedAt: new Date().toISOString()
  }
  const index = list.findIndex((item) => item.planId === planId)
  if (index >= 0) {
    list[index] = { ...list[index], ...entry }
  } else {
    list.unshift(entry)
  }
  data[key] = list.slice(0, MAX_PLANS)
  writeAll(data)
  return entry
}

export function updatePlanStatus(scope, planId, status) {
  if (!planId) return
  const key = scopeKey(scope)
  const data = readAll()
  const list = Array.isArray(data[key]) ? data[key] : []
  const index = list.findIndex((item) => item.planId === planId)
  if (index < 0) return
  list[index] = { ...list[index], status, savedAt: new Date().toISOString() }
  data[key] = list
  writeAll(data)
}

export function planToMarkdown(plan) {
  if (!plan) return ''
  const lines = []
  lines.push(`# ${plan.title || '未命名方案'}`)
  if (plan.description) lines.push('', plan.description)
  lines.push('', '## 基本信息')
  if (plan.audience) lines.push(`- 目标人群：${plan.audience}`)
  if (plan.questionCount) lines.push(`- 题目数量：${plan.questionCount}`)
  if (plan.typeMix && Object.keys(plan.typeMix).length) {
    const mix = Object.keys(plan.typeMix)
      .map((key) => `${key} ${plan.typeMix[key]} 道`)
      .join('，')
    lines.push(`- 题型分布：${mix}`)
  }
  if (Array.isArray(plan.outline) && plan.outline.length) {
    lines.push('', '## 题目大纲')
    plan.outline.forEach((item, index) => {
      const options =
        Array.isArray(item.options) && item.options.length
          ? `（${item.options.join(' / ')}）`
          : ''
      lines.push(`${index + 1}. [${item.type || '题目'}] ${item.title || ''}${options}`)
      if (item.reason) lines.push(`   - 设计理由：${item.reason}`)
      if (item.targetFormItemId) lines.push(`   - 原题 ID：${item.targetFormItemId}`)
    })
  }
  if (Array.isArray(plan.changeSummary) && plan.changeSummary.length) {
    lines.push('', '## 变更摘要')
    plan.changeSummary.forEach((item) => lines.push(`- ${item}`))
  }
  if (Array.isArray(plan.assumptions) && plan.assumptions.length) {
    lines.push('', '## 假设')
    plan.assumptions.forEach((item) => lines.push(`- ${item}`))
  }
  if (Array.isArray(plan.risks) && plan.risks.length) {
    lines.push('', '## 风险与注意事项')
    plan.risks.forEach((item) => lines.push(`- ${item}`))
  }
  if (plan.savedAt) lines.push('', `> 保存时间：${plan.savedAt}`)
  return lines.join('\n')
}
