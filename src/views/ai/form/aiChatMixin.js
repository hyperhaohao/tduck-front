import { jsonrepair } from 'jsonrepair'
import { getAiStatus, streamFormChat } from '@/api/ai'
import { createThinkFilter } from './thinkFilter'
import { listPlans, savePlan, updatePlanStatus } from './planStore'

const THINK_KEY = 'ruima.ai.thinking'
const WORKFLOW_KEY = 'ruima.ai.workflow'
let seq = 0

function uid() {
  seq += 1
  return `ai-${Date.now()}-${seq}`
}

function parseAiJson(raw) {
  if (!raw) return null
  try {
    const text = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    return JSON.parse(jsonrepair(text))
  } catch (e) {
    return null
  }
}

/**
 * AI 会话共享逻辑：方案模式状态机、历史裁剪、流式事件分发、方案留存。
 * 独立建表页和设计器 AI 协作抽屉共用。
 */
export default {
  data() {
    return {
      aiMessages: [],
      aiStatus: null,
      aiStatusError: '',
      aiStreaming: false,
      aiStreamingMessageId: null,
      aiAbortController: null,
      aiHistoryTrimmed: false,
      aiThinkingEnabled: localStorage.getItem(THINK_KEY) === '1',
      aiWorkflowMode: localStorage.getItem(WORKFLOW_KEY) === 'quick' ? 'quick' : 'plan',
      aiStage: 'idle',
      aiPendingClarify: null,
      aiCurrentPlan: null,
      aiCurrentPlanMessageId: null,
      aiPlanStatus: '',
      aiHasGenerated: false,
      aiSavedPlans: [],
      aiAutoPlanPending: false
    }
  },
  computed: {
    aiConfigured() {
      return !!(this.aiStatus && this.aiStatus.configured)
    },
    aiStatusMessage() {
      if (this.aiStatusError) return this.aiStatusError
      return (this.aiStatus && this.aiStatus.message) || ''
    }
  },
  watch: {
    aiThinkingEnabled(val) {
      localStorage.setItem(THINK_KEY, val ? '1' : '0')
    },
    aiWorkflowMode(val) {
      localStorage.setItem(WORKFLOW_KEY, val)
    }
  },
  beforeDestroy() {
    this.stopAiGeneration(true)
  },
  methods: {
    async loadAiStatus() {
      this.aiStatusError = ''
      try {
        const res = await getAiStatus()
        this.aiStatus = res.data || null
      } catch (e) {
        this.aiStatusError = e.msg || e.message || '无法检查 AI 服务状态'
        this.aiStatus = { configured: false, message: this.aiStatusError }
      }
    },

    /** 子类覆盖：方案留存作用域（create 或 form:<key>）。 */
    aiPlanScope() {
      return 'create'
    },

    /** 子类覆盖：请求前刷新上下文（设计器读取当前表单）。 */
    async beforeAiRequest() {},

    /** 子类覆盖：返回当前表单 JSON 字符串。 */
    aiCurrentForm() {
      return null
    },

    /** 子类覆盖：返回额外请求字段（mode / formKey）。 */
    aiRequestMeta() {
      return {}
    },

    loadAiPlans() {
      this.aiSavedPlans = listPlans(this.aiPlanScope())
    },

    updateAiPlanStatus(status) {
      if (!this.aiCurrentPlan) return
      this.aiPlanStatus = status
      this.aiCurrentPlan.status = status
      if (this.aiCurrentPlan.planId) {
        updatePlanStatus(this.aiPlanScope(), this.aiCurrentPlan.planId, status)
      }
      this.loadAiPlans()
    },

    aiBuildHistory() {
      const history = this.aiMessages
        .filter(
          (msg) =>
            (msg.role === 'user' && msg.content) ||
            (msg.role === 'assistant' && msg.status === 'done' && msg.raw)
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.role === 'user' ? msg.content : msg.raw
        }))
      if (history.length <= 20) return history
      return [history[0], ...history.slice(-19)]
    },

    /**
     * 工作流入口：方案模式走 澄清 → 方案 → 确认 → 生成；快速模式直接生成。
     */
    startAiWorkflow(text) {
      const content = (text || '').trim()
      if (!content || this.aiStreaming) return
      if (this.aiStatus && this.aiStatus.configured === false) {
        if (this.$message) this.$message.error(this.aiStatus.message || 'AI 服务未配置')
        return
      }
      if (this.aiWorkflowMode === 'quick') {
        this.sendAiMessage(content, { stage: 'generate' })
        return
      }
      if (this.aiPendingClarify) {
        this.deactivateClarify()
        this.aiPendingClarify = null
        this.sendAiMessage(content, { stage: 'plan' })
        return
      }
      if (this.aiCurrentPlan && this.aiPlanStatus === 'draft') {
        this.reviseAiPlan(content)
        return
      }
      if (this.aiHasGenerated) {
        this.sendAiMessage(content, {
          stage: 'generate',
          planJson: this.aiCurrentPlan ? JSON.stringify(this.aiCurrentPlan) : undefined
        })
        return
      }
      this.sendAiMessage(content, { stage: 'clarify' })
    },

    async sendAiMessage(text, options = {}) {
      const content = (text || '').trim()
      if (!content || this.aiStreaming) return
      if (this.aiStatus && this.aiStatus.configured === false) {
        if (this.$message) this.$message.error(this.aiStatus.message || 'AI 服务未配置')
        return
      }
      const stage = options.stage || 'generate'
      if (!options.retry) {
        this.aiMessages.push({ id: uid(), role: 'user', content, status: 'done' })
      }
      const assistant = {
        id: uid(),
        role: 'assistant',
        stage,
        status: 'streaming',
        raw: '',
        text: '',
        thinking: '',
        error: '',
        code: '',
        retryable: false,
        model: '',
        summary: ''
      }
      this.aiMessages.push(assistant)
      this.aiStreaming = true
      this.aiStreamingMessageId = assistant.id
      this.aiHistoryTrimmed = false
      this.aiAbortController = new AbortController()
      const filter = createThinkFilter()
      assistant._filter = filter

      try {
        await this.beforeAiRequest(stage)
        const history = this.aiBuildHistory()
        const payload = {
          requestId: assistant.id,
          messages: history,
          currentForm: this.aiCurrentForm() || undefined,
          planJson: options.planJson || undefined,
          stage,
          thinking: !!this.aiThinkingEnabled,
          ...this.aiRequestMeta()
        }
        await streamFormChat(payload, {
          signal: this.aiAbortController.signal,
          onEvent: (event) => this.handleAiEvent(event, assistant, filter)
        })
        if (assistant.status === 'streaming') {
          this.finishAiAssistant(assistant, { type: 'done', finishReason: 'stop' })
        }
      } catch (e) {
        if (e && e.name === 'AbortError') {
          assistant.status = 'stopped'
          assistant.summary = '已停止生成'
        } else {
          this.markAiError(assistant, e)
        }
      } finally {
        this.aiStreaming = false
        this.aiStreamingMessageId = null
        this.aiAbortController = null
        this.afterAiStream(assistant)
        if (this.aiAutoPlanPending) {
          this.aiAutoPlanPending = false
          this.sendAiMessage('信息已足够，请直接给出设计方案。', { stage: 'plan' })
        }
      }
    },

    handleAiEvent(event, assistant, filter) {
      if (!event || !event.type) return
      if (event.type === 'meta') {
        assistant.model = event.model || ''
        this.aiHistoryTrimmed = !!event.historyTrimmed
        if (this.onAiMeta) this.onAiMeta(event, assistant)
        return
      }
      if (event.type === 'thinking') {
        assistant.thinking += event.delta || ''
        if (this.onAiThinkingDelta) this.onAiThinkingDelta(event.delta, assistant)
        return
      }
      if (event.type === 'content') {
        const piece = filter.push(event.delta || '')
        if (piece.thinking) assistant.thinking += piece.thinking
        if (piece.content) {
          assistant.text += piece.content
          if (this.onAiContentDelta) this.onAiContentDelta(piece.content, assistant)
        }
        return
      }
      if (event.type === 'done') {
        this.finishAiAssistant(assistant, event)
        return
      }
      if (event.type === 'error') {
        this.markAiError(assistant, event)
      }
    },

    finishAiAssistant(assistant, doneEvent) {
      if (assistant.status !== 'streaming') return
      const tail = assistant._filter ? assistant._filter.flush() : { content: '', thinking: '' }
      if (tail.content) assistant.text += tail.content
      if (tail.thinking) assistant.thinking += tail.thinking
      assistant.raw = (assistant.text || '').trim()
      if (doneEvent && doneEvent.truncated) {
        assistant.status = 'error'
        assistant.error = 'AI 输出被截断，请重试或关闭深入思考。'
        assistant.retryable = true
        assistant.summary = assistant.raw ? '输出不完整，已保留部分内容' : '生成失败'
        if (this.onAiAssistantError) {
          this.onAiAssistantError(
            { message: assistant.error, code: 'AI_OUTPUT_TRUNCATED', retryable: true },
            assistant
          )
        }
        return
      }
      if (!assistant.raw) {
        assistant.status = 'error'
        assistant.error = 'AI 未返回内容，请重试。'
        assistant.retryable = true
        assistant.summary = '生成失败'
        if (this.onAiAssistantError) {
          this.onAiAssistantError(
            { message: assistant.error, code: 'AI_EMPTY_RESULT', retryable: true },
            assistant
          )
        }
        return
      }
      assistant.status = 'done'
      if (assistant.stage === 'clarify') {
        this.handleAiClarifyDone(assistant)
        return
      }
      if (assistant.stage === 'plan') {
        this.handleAiPlanDone(assistant)
        return
      }
      this.aiHasGenerated = true
      if (this.aiCurrentPlan && this.aiPlanStatus === 'confirmed') {
        this.updateAiPlanStatus('generated')
        const msg = this.aiMessages.find((item) => item.id === this.aiCurrentPlanMessageId)
        if (msg) this.$set(msg, 'planStatus', 'generated')
      }
      if (!assistant.summary) assistant.summary = '生成完成'
      if (this.onAiAssistantDone) this.onAiAssistantDone(assistant)
    },

    handleAiClarifyDone(assistant) {
      const payload = parseAiJson(assistant.raw)
      if (!payload || typeof payload !== 'object') {
        assistant.status = 'error'
        assistant.error = 'AI 返回的澄清内容格式不正确，请重试。'
        assistant.retryable = true
        assistant.summary = '生成失败'
        return
      }
      const questions = (Array.isArray(payload.questions) ? payload.questions : []).slice(0, 3)
      const needs = !!payload.needsClarification && questions.length > 0
      this.$set(assistant, 'clarify', {
        needsClarification: needs,
        questions,
        defaults: payload.defaults || ''
      })
      this.$set(assistant, 'clarifyActive', needs)
      assistant.summary = needs ? `需要确认 ${questions.length} 个问题` : '需求已明确'
      this.aiStage = needs ? 'clarify' : 'plan'
      if (needs) {
        this.aiPendingClarify = assistant.clarify
        return
      }
      this.aiAutoPlanPending = this.aiWorkflowMode === 'plan'
    },

    handleAiPlanDone(assistant) {
      const payload = parseAiJson(assistant.raw)
      if (!payload || !Array.isArray(payload.outline)) {
        assistant.status = 'error'
        assistant.error = 'AI 返回的方案格式不完整，请重试。'
        assistant.retryable = true
        assistant.summary = '生成失败'
        return
      }
      this.aiMessages.forEach((msg) => {
        if (msg !== assistant && msg.role === 'assistant' && msg.planActive) {
          this.$set(msg, 'planActive', false)
        }
      })
      this.$set(assistant, 'planPayload', payload)
      this.$set(assistant, 'planStatus', 'draft')
      this.$set(assistant, 'planActive', true)
      assistant.summary = '方案已生成，等待确认'
      this.aiCurrentPlan = payload
      this.aiCurrentPlanMessageId = assistant.id
      this.aiPlanStatus = 'draft'
      this.aiPendingClarify = null
      this.aiStage = 'plan'
      const entry = savePlan(this.aiPlanScope(), { ...payload, status: 'draft' })
      payload.planId = entry.planId
      this.loadAiPlans()
    },

    deactivateClarify() {
      this.aiMessages.forEach((msg) => {
        if (msg.clarifyActive) this.$set(msg, 'clarifyActive', false)
      })
    },

    submitAiClarify(payload) {
      const answers = (payload && payload.answers) || []
      const text = answers
        .filter((item) => item.answer)
        .map((item) => `${item.question}：${item.answer}`)
        .join('\n')
      this.deactivateClarify()
      this.aiPendingClarify = null
      this.sendAiMessage(text || '按默认设置继续，请给出设计方案。', { stage: 'plan' })
    },

    skipAiClarify() {
      this.deactivateClarify()
      this.aiPendingClarify = null
      this.sendAiMessage('按默认设置继续，请给出设计方案。', { stage: 'plan' })
    },

    confirmAiPlan() {
      if (!this.aiCurrentPlan || this.aiStreaming) return
      this.updateAiPlanStatus('confirmed')
      const msg = this.aiMessages.find((item) => item.id === this.aiCurrentPlanMessageId)
      if (msg) this.$set(msg, 'planStatus', 'confirmed')
      const planJson = JSON.stringify(this.aiCurrentPlan)
      this.sendAiMessage('确认方案，请按方案生成完整表单。', { stage: 'generate', planJson })
    },

    reviseAiPlan(text) {
      const content = (text || '').trim()
      if (!content || !this.aiCurrentPlan || this.aiStreaming) return
      this.sendAiMessage(content, {
        stage: 'plan',
        planJson: JSON.stringify(this.aiCurrentPlan)
      })
    },

    cancelAiPlan() {
      if (!this.aiCurrentPlan) return
      this.updateAiPlanStatus('cancelled')
      const msg = this.aiMessages.find((item) => item.id === this.aiCurrentPlanMessageId)
      if (msg) {
        this.$set(msg, 'planActive', false)
        msg.summary = '已放弃本次方案'
      }
      this.aiCurrentPlan = null
      this.aiCurrentPlanMessageId = null
      this.aiPlanStatus = 'cancelled'
    },

    markAiPlanApplied() {
      if (!this.aiCurrentPlan) return
      this.updateAiPlanStatus('applied')
      const msg = this.aiMessages.find((item) => item.id === this.aiCurrentPlanMessageId)
      if (msg) this.$set(msg, 'planStatus', 'applied')
    },

    markAiError(assistant, error) {
      assistant.status = 'error'
      assistant.error = (error && (error.message || error.msg)) || 'AI 请求失败'
      assistant.code = (error && error.code) || ''
      assistant.retryable = !error || error.retryable !== false
      assistant.summary = assistant.raw || assistant.text ? '生成中断，已保留部分内容' : '生成失败'
      if (this.onAiAssistantError) this.onAiAssistantError(error, assistant)
    },

    stopAiGeneration(silent = false) {
      if (this.aiAbortController) {
        this.aiAbortController.abort()
      }
      if (!silent) {
        const message = this.aiMessages.find((msg) => msg.id === this.aiStreamingMessageId)
        if (message && message.status === 'streaming') {
          message.status = 'stopped'
          message.summary = '已停止生成'
        }
      }
    },

    resetAiConversation() {
      this.stopAiGeneration(true)
      this.aiMessages = []
      this.aiHistoryTrimmed = false
      this.aiStreaming = false
      this.aiStreamingMessageId = null
      this.aiAbortController = null
      this.aiStage = 'idle'
      this.aiPendingClarify = null
      this.aiCurrentPlan = null
      this.aiCurrentPlanMessageId = null
      this.aiPlanStatus = ''
      this.aiHasGenerated = false
      this.aiAutoPlanPending = false
      this.loadAiPlans()
      if (this.onAiConversationReset) this.onAiConversationReset()
    },

    retryLastAiMessage() {
      if (this.aiStreaming) return
      const lastUserIndex = [...this.aiMessages]
        .map((msg, index) => ({ msg, index }))
        .filter((item) => item.msg.role === 'user')
        .pop()
      if (!lastUserIndex) return
      const lastAssistant = [...this.aiMessages]
        .reverse()
        .find((msg) => msg.role === 'assistant')
      const stage = (lastAssistant && lastAssistant.stage) || 'generate'
      this.aiMessages = this.aiMessages.slice(0, lastUserIndex.index + 1)
      this.sendAiMessage(lastUserIndex.msg.content, {
        retry: true,
        stage,
        planJson:
          stage === 'generate' && this.aiCurrentPlan
            ? JSON.stringify(this.aiCurrentPlan)
            : undefined
      })
    },

    afterAiStream() {}
  }
}
