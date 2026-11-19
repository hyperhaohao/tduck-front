// 解析 AI 返回的表单 JSON 为设计器字段
import TduckForm from 'tduck-form-generator'
import { toLower } from 'lodash'

/**
 * 解析 AI 返回对象：兼容新对象信封、旧数组和 fields/questions/list 包裹。
 * 返回 { title, description, plan, questions }。
 */
export const parseAiPayload = (json) => {
  const empty = { title: '', description: '', plan: [], questions: [] }
  if (!json) return empty

  let data
  try {
    if (typeof json === 'string') {
      const text = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      data = JSON.parse(text)
    } else {
      data = json
    }
  } catch (e) {
    return empty
  }
  if (!data) return empty

  let plan = []
  let title = ''
  let description = ''
  let questions = []

  if (Array.isArray(data)) {
    questions = data
  } else if (typeof data === 'object') {
    plan = Array.isArray(data.plan) ? data.plan.filter((item) => typeof item === 'string') : []
    title = data.title || data.name || ''
    description = data.description || data.summary || ''
    if (Array.isArray(data.questions)) questions = data.questions
    else if (Array.isArray(data.fields)) questions = data.fields
    else if (Array.isArray(data.list)) questions = data.list
  }

  // 兼容旧格式：数组中使用「问卷标题 / 问卷描述」元素
  const normalized = []
  questions.forEach((item) => {
    if (!item) return
    if (item.type === '问卷标题') {
      title = title || item.title || ''
      return
    }
    if (item.type === '问卷描述') {
      description = description || item.title || ''
      return
    }
    normalized.push(item)
  })

  return { title, description, plan, questions: normalized }
}

const getBasicComponents = () => {
  const allComponents = TduckForm.GenerateConfig?.allComponents || []
  const basicCompGroup = allComponents.find((group) => group.title === '基础组件')
  return basicCompGroup ? basicCompGroup.list : allComponents[0]?.list || []
}

/**
 * 把 AI 的题目数组转换为 tduck-form-generator 字段。
 */
export const parseJsonToFields = (json) => {
  const payload = parseAiPayload(json)
  const basicComponents = getBasicComponents()

  const inputConfig = basicComponents.find((item) => item.typeId === 'INPUT')
  const textareaConfig = basicComponents.find((item) => item.typeId === 'TEXTAREA')
  const dateConfig = basicComponents.find((item) => item.typeId === 'DATE')
  const numberConfig = basicComponents.find((item) => item.typeId === 'NUMBER')
  const radioConfig = basicComponents.find((item) => item.typeId === 'RADIO')
  const checkboxConfig = basicComponents.find((item) => item.typeId === 'CHECKBOX')
  const selectConfig = basicComponents.find((item) => item.typeId === 'SELECT')

  const filedTypeMap = {
    单行文本: inputConfig,
    多行文本: textareaConfig,
    日期: dateConfig,
    数字: numberConfig,
    单选: radioConfig,
    多选: checkboxConfig,
    下拉: selectConfig
  }

  const time = new Date().getTime()
  const formInfo = {
    title: payload.title || '',
    description: payload.description || ''
  }
  const fields = payload.questions
    .map((item, index) => {
      if (!item) return null
      const fieldTemplate = filedTypeMap[item.type]
      if (!fieldTemplate) return null

      const field = JSON.parse(JSON.stringify(fieldTemplate))
      if (field.config) {
        field.config.label = item.title || ''
      }
      if (field.config && field.config.options && Array.isArray(item.options)) {
        field.config.options = item.options.map((option, optionIndex) => {
          const label = typeof option === 'string' ? option : option && option.label
          return {
            type: label === '其他' ? 'input' : 'option',
            label: label || '',
            value: optionIndex + 1
          }
        })
      }
      if (field.config) {
        field.config.formId = `${toLower(field.typeId)}${+time + index}`
        field.vModel = field.config.formId
      }
      return field
    })
    .filter((item) => item)

  return {
    fields,
    formInfo,
    plan: payload.plan,
    questions: payload.questions
  }
}
