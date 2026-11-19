import TduckForm from 'tduck-form-generator'
import { cloneDeep, isObject } from 'lodash'
import {
  batchCreateProjectItem,
  updateProjectItem,
  deleteProjectItem,
  sortProjectItem,
  updateFormRequest,
  listProjectItemRequest
} from '@/api/project/form'
import { parseJsonToFields } from './convertToFields'

export function removeHtmlTag(str) {
  if (!str) return ''
  return str
    .replace(/<formvariable[^<]*<\/formvariable>/g, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, '')
}

/**
 * 把设计器字段对象转换为后端表单项实体。与 tduck-form-generator 内部逻辑保持一致。
 */
export function formItemConvertData(item, formKey) {
  return {
    type: item.typeId,
    formItemId: item.config.formId,
    label: item.config.label,
    defaultValue: isObject(item.config.defaultValue)
      ? JSON.stringify(item.config.defaultValue)
      : item.config.defaultValue,
    required: item.config.required,
    placeholder: removeHtmlTag(item.placeholder),
    regList: item.config.regList,
    showLabel: item.config.showLabel,
    span: item.config.span,
    displayType: item.config.displayType,
    hideType: item.config.hideType,
    scheme: item,
    formKey
  }
}

let componentLabelMapCache = null

export const AI_SUPPORTED_TYPE_IDS = [
  'INPUT',
  'TEXTAREA',
  'DATE',
  'NUMBER',
  'SELECT',
  'RADIO',
  'CHECKBOX'
]

/**
 * AI 提示词使用的短题型名。不能直接用组件配置里的展示名（如“单选框组”），
 * 否则类型判断和反向映射都会失败。
 */
const AI_TYPE_LABELS = {
  INPUT: '单行文本',
  TEXTAREA: '多行文本',
  DATE: '日期',
  NUMBER: '数字',
  SELECT: '下拉',
  RADIO: '单选',
  CHECKBOX: '多选'
}

const AI_LABEL_TYPES = Object.keys(AI_TYPE_LABELS).reduce((map, typeId) => {
  map[AI_TYPE_LABELS[typeId]] = typeId
  return map
}, {})

function componentLabelMap() {
  if (componentLabelMapCache) return componentLabelMapCache
  const all = TduckForm.GenerateConfig?.allComponents || []
  const map = {}
  all.forEach((group) => {
    ;(group.list || []).forEach((item) => {
      map[item.typeId] = (item.config && item.config.label) || item.typeId
    })
  })
  componentLabelMapCache = map
  return map
}

export function typeLabelOf(typeId) {
  return AI_TYPE_LABELS[typeId] || componentLabelMap()[typeId] || typeId
}

export function typeIdOfLabel(label) {
  if (AI_LABEL_TYPES[label]) return AI_LABEL_TYPES[label]
  const map = componentLabelMap()
  const entry = Object.keys(map).find((key) => map[key] === label)
  return entry || null
}

function optionsOf(item) {
  const config = (item && item.scheme && item.scheme.config) || {}
  const options = Array.isArray(config.options) ? config.options : []
  return options
    .map((option) => (typeof option === 'string' ? option : option && option.label))
    .filter(Boolean)
}

/**
 * 当前表单转换为 AI 可理解的上下文。
 */
export function itemsToAiForm(items, form) {
  const questions = (items || []).map((item) => {
    const question = {
      formItemId: item.formItemId,
      type: typeLabelOf(item.type),
      title: item.label
    }
    const options = optionsOf(item)
    if (options.length) question.options = options
    if (!AI_SUPPORTED_TYPE_IDS.includes(item.type)) question.locked = true
    if (item.required) question.required = true
    return question
  })
  return {
    title: (form && (form.name || form.title)) || '',
    description: (form && form.description) || '',
    questions
  }
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return null
  return options
    .map((option) => (typeof option === 'string' ? option : option && option.label))
    .filter(Boolean)
}

/**
 * 对比当前题目与 AI 返回的题目。
 */
export function diffAiForm(currentItems, proposedQuestions) {
  const current = currentItems || []
  const currentById = new Map(current.map((item) => [item.formItemId, item]))
  const proposedIds = new Set()
  const create = []
  const update = []
  const unchanged = []
  const typeChanges = []

  ;(proposedQuestions || []).forEach((question) => {
    if (!question || question.locked) return
    const typeId = typeIdOfLabel(question.type)
    if (!typeId) return
    const existing = question.formItemId && currentById.get(question.formItemId)
    if (existing) {
      if (existing.type !== typeId) {
        typeChanges.push({ question, current: existing, typeId })
        create.push({ question, typeId })
        return
      }
      proposedIds.add(existing.formItemId)
      const newOptions = normalizeOptions(question.options)
      const oldOptions = optionsOf(existing)
      const optionsChanged =
        newOptions !== null && JSON.stringify(newOptions) !== JSON.stringify(oldOptions)
      const requiredChanged =
        question.required !== undefined && !!question.required !== !!existing.required
      if ((question.title || '') !== (existing.label || '') || optionsChanged || requiredChanged) {
        update.push({ question, current: existing, typeId })
      } else {
        unchanged.push(question)
      }
    } else {
      create.push({ question, typeId })
    }
  })

  const remove = current.filter(
    (item) =>
      !proposedIds.has(item.formItemId) && AI_SUPPORTED_TYPE_IDS.includes(item.type)
  )

  return { create, update, remove, unchanged, typeChanges }
}

function buildUpdatePayload(formKey, entry) {
  const current = entry.current
  const question = entry.question
  const scheme = cloneDeep(current.scheme || {})
  scheme.typeId = current.type
  scheme.placeholder = scheme.placeholder || current.placeholder || ''
  scheme.config = scheme.config || {}
  scheme.config.formId = current.formItemId
  scheme.config.label = question.title || current.label
  scheme.config.required =
    question.required !== undefined ? !!question.required : current.required
  scheme.config.regList = current.regList
  scheme.config.showLabel = current.showLabel
  scheme.config.span = current.span
  scheme.config.defaultValue = current.defaultValue
  scheme.config.displayType = current.displayType
  scheme.config.hideType = current.hideType
  if (Array.isArray(question.options)) {
    scheme.config.options = question.options.map((label, index) => ({
      type: label === '其他' ? 'input' : 'option',
      label,
      value: index + 1
    }))
  }
  scheme.displayType = current.displayType
  scheme.hideType = current.hideType
  scheme.sort = current.sort
  return formItemConvertData(scheme, formKey)
}

/**
 * 应用 AI 修改：更新 → 新建 → 删除 → 标题描述 → 排序。
 * 返回每个步骤的执行结果，便于界面提示。
 */
export async function applyAiForm({ formKey, currentItems, proposed, form }) {
  if (!proposed || !Array.isArray(proposed.questions) || !proposed.questions.length) {
    throw new Error('AI 未返回题目变更，已取消应用')
  }
  const diff = diffAiForm(currentItems, proposed.questions)
  const result = {
    updated: 0,
    created: 0,
    removed: 0,
    titleUpdated: false,
    orderAdjusted: false,
    orderWarning: '',
    lockedCount: (currentItems || []).filter(
      (item) => !AI_SUPPORTED_TYPE_IDS.includes(item.type)
    ).length
  }

  for (const entry of diff.update) {
    await updateProjectItem(buildUpdatePayload(formKey, entry))
    result.updated += 1
  }

  let createdFields = []
  const createdIdByQuestion = new Map()
  if (diff.create.length) {
    const parsed = parseJsonToFields({
      title: proposed.title || '',
      description: proposed.description || '',
      questions: diff.create.map((entry) => entry.question)
    })
    createdFields = parsed.fields
    diff.create.forEach((entry, index) => {
      const field = createdFields[index]
      if (field && field.config) createdIdByQuestion.set(entry.question, field.config.formId)
    })
    if (createdFields.length) {
      await batchCreateProjectItem(createdFields.map((field) => formItemConvertData(field, formKey)))
      result.created = createdFields.length
    }
  }

  for (const item of diff.remove) {
    await deleteProjectItem({ formKey, formItemId: item.formItemId })
    result.removed += 1
  }

  const newTitle = proposed.title || (form && (form.name || form.title)) || ''
  const newDescription = proposed.description
    ? proposed.description
    : (form && form.description) || ''
  if (
    (form && newTitle && newTitle !== form.name) ||
    (form && newDescription !== (form.description || ''))
  ) {
    await updateFormRequest({ formKey, name: newTitle, description: newDescription })
    result.titleUpdated = true
  }

  // 含不支持题型时不做自动排序，避免打乱 locked 题目位置
  if (result.lockedCount === 0 && proposed.questions && proposed.questions.length) {
    try {
      result.orderAdjusted = await applyOrder(
        formKey,
        proposed.questions,
        createdIdByQuestion
      )
    } catch (e) {
      result.orderWarning = '题目顺序调整失败，请在设计器中手动拖动排序'
    }
  } else if (result.lockedCount > 0) {
    result.orderWarning = '含不支持的题型，未自动调整顺序，请在设计器中确认'
  }

  return { ...result, diff }
}

/**
 * 按 AI 返回顺序排序。新题目的 formItemId 由前端生成，因此创建后可用。
 */
async function applyOrder(formKey, proposedQuestions, createdIdByQuestion) {
  const desiredIds = []
  proposedQuestions.forEach((question) => {
    const createdId = createdIdByQuestion && createdIdByQuestion.get(question)
    if (createdId) {
      desiredIds.push(createdId)
    } else if (question.formItemId) {
      desiredIds.push(question.formItemId)
    }
  })
  if (!desiredIds.length) return false

  let items = (await listProjectItemRequest({ key: formKey })) || null
  items = (items && items.data) || []
  items.sort((a, b) => (a.sort || 0) - (b.sort || 0))
  const currentOrder = items.map((item) => item.formItemId)
  if (JSON.stringify(currentOrder) === JSON.stringify(desiredIds)) return false

  const byId = new Map(items.map((item) => [item.formItemId, item]))
  let ordered = items.map((item) => item.formItemId)
  for (let index = 0; index < desiredIds.length; index += 1) {
    const id = desiredIds[index]
    if (!byId.has(id)) continue
    if (ordered[index] === id) continue
    const before = index > 0 ? byId.get(desiredIds[index - 1]) : null
    const after = index < desiredIds.length - 1 ? byId.get(desiredIds[index + 1]) : null
    const payload = { formKey, formItemId: id }
    if (before && before.sort !== undefined) payload.beforePosition = before.sort
    if (after && after.sort !== undefined) payload.afterPosition = after.sort
    if (payload.beforePosition === undefined && payload.afterPosition === undefined) continue
    const response = await sortProjectItem(payload)
    if (response && response.data && response.data.sort !== undefined) {
      byId.get(id).sort = response.data.sort
    }
    ordered.splice(ordered.indexOf(id), 1)
    ordered.splice(index, 0, id)
  }
  return true
}
