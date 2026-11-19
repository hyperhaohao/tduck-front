<template>
  <div v-show="visible" class="ai-dock" :style="{ width: panelWidth + 'px' }">
    <div class="ai-resizer" title="拖拽调整宽度" @mousedown="startResize"></div>
    <div class="designer-chat">
      <div class="drawer-head">
        <div class="drawer-title">
          <h3>AI 协作</h3>
          <p>基于当前表单对话修改，先方案后生成，确认后写回</p>
        </div>
        <el-button class="drawer-close" type="text" icon="el-icon-close" @click="close" />
      </div>

      <ai-chat-panel
        :messages="aiMessages"
        :status="aiStatus"
        :status-error="aiStatusError"
        :streaming="aiStreaming"
        :thinking.sync="aiThinkingEnabled"
        :workflow-mode.sync="aiWorkflowMode"
        :saved-plans="aiSavedPlans"
        :plan-status="aiPlanStatus"
        :can-config="isGlobalAdmin"
        placeholder="例如：把第 2 题改成多选，并新增一道数字题"
        empty-title="描述您想怎样修改当前表单"
        empty-hint="AI 会先给出修改方案，确认后再生成并写回设计器"
        @send="handleSend"
        @stop="stopAiGeneration"
        @reset="restartConversation"
        @retry="retryLastAiMessage"
        @config="goAiConfig"
        @clarify-submit="submitAiClarify"
        @clarify-skip="skipAiClarify"
        @plan-confirm="confirmAiPlan"
        @plan-revise="reviseAiPlan"
        @plan-cancel="cancelAiPlan"
      >
        <template v-slot:assistant-extra="{ message }">
          <div v-if="message.proposal" class="ai-proposal">
            <div v-if="message.proposal.plan.length" class="ai-plan">
              <div class="ai-plan-title">修改方案</div>
              <ol>
                <li v-for="(item, index) in message.proposal.plan" :key="index">{{ item }}</li>
              </ol>
            </div>

            <div class="ai-diff">
              <span class="ai-diff-chip create">新增 {{ message.proposal.diff.create.length }}</span>
              <span class="ai-diff-chip update">修改 {{ message.proposal.diff.update.length }}</span>
              <span class="ai-diff-chip remove">删除 {{ message.proposal.diff.remove.length }}</span>
              <span class="ai-diff-chip keep">未变 {{ message.proposal.diff.unchanged.length }}</span>
            </div>

            <div v-if="hasChanges(message.proposal.diff)" class="ai-change-list">
              <div v-for="(entry, index) in message.proposal.diff.create" :key="'c' + index" class="ai-change">
                <span class="ai-change-tag create">新增</span>
                <span class="ai-change-text">{{ entry.question.title }}</span>
              </div>
              <div v-for="(entry, index) in message.proposal.diff.update" :key="'u' + index" class="ai-change">
                <span class="ai-change-tag update">修改</span>
                <span class="ai-change-text">
                  {{ entry.current.label }}
                  <template v-if="entry.current.label !== entry.question.title">
                    → {{ entry.question.title }}
                  </template>
                </span>
              </div>
              <div v-for="(entry, index) in message.proposal.diff.typeChanges" :key="'t' + index" class="ai-change">
                <span class="ai-change-tag update">题型</span>
                <span class="ai-change-text">
                  {{ entry.current.label }}（{{ typeLabelOf(entry.current.type) }} → {{ typeLabelOf(entry.typeId) }}）
                </span>
              </div>
              <div v-for="(item, index) in message.proposal.diff.remove" :key="'r' + index" class="ai-change">
                <span class="ai-change-tag remove">删除</span>
                <span class="ai-change-text">{{ item.label }}</span>
              </div>
            </div>

            <div v-if="message.proposalApplied" class="ai-applied">已应用到设计器</div>
            <div v-else-if="canApply(message.proposal)" class="ai-proposal-actions">
              <el-button type="primary" size="small" :loading="applying" @click="applyProposal(message)">
                应用修改
              </el-button>
              <el-button size="small" @click="discardProposal(message)">放弃</el-button>
            </div>
            <div v-else class="ai-applied">未检测到需要应用的变更</div>
            <div v-if="!message.proposalApplied && canApply(message.proposal)" class="ai-proposal-tip">
              应用前请确认方案；应用后设计器会自动刷新
            </div>
          </div>
        </template>
      </ai-chat-panel>
    </div>
  </div>
</template>

<script>
import { jsonrepair } from 'jsonrepair'
import AiChatPanel from './AiChatPanel.vue'
import aiChatMixin from './aiChatMixin'
import { parseAiPayload } from './convertToFields'
import { itemsToAiForm, diffAiForm, applyAiForm, typeLabelOf } from './formBridge'
import {
  listProjectItemRequest,
  getProjectRequest,
  getFormLogicRequest
} from '@/api/project/form'
import { demandState } from '@/utils/demand'

const WIDTH_KEY = 'ruima.ai.panelWidth'
const DEFAULT_WIDTH = 340

export default {
  name: 'DesignerChat',
  components: { AiChatPanel },
  mixins: [aiChatMixin],
  props: {
    formKey: { type: String, default: '' },
    visible: { type: Boolean, default: false }
  },
  data() {
    return {
      currentItems: [],
      currentForm: null,
      currentFormJson: '',
      baselineSignature: '',
      applying: false,
      panelWidth: DEFAULT_WIDTH,
      resizeMoveHandler: null,
      resizeUpHandler: null
    }
  },
  computed: {
    isGlobalAdmin() {
      return !demandState.enabled || demandState.global
    }
  },
  watch: {
    visible(value) {
      if (value) this.openCollab()
    }
  },
  created() {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    if (saved >= 280 && saved <= 420) this.panelWidth = saved
  },
  beforeDestroy() {
    this.stopResize()
  },
  methods: {
    typeLabelOf,
    close() {
      this.$emit('update:visible', false)
    },
    async openCollab() {
      await this.loadAiStatus()
      this.loadAiPlans()
      if (this.formKey) {
        try {
          await this.refreshCurrentForm()
        } catch (e) {
          this.$message.error((e && (e.msg || e.message)) || '读取当前表单失败')
        }
      }
    },
    async refreshCurrentForm() {
      if (!this.formKey) throw new Error('缺少表单标识')
      const [itemsRes, formRes] = await Promise.all([
        listProjectItemRequest({ key: this.formKey }),
        getProjectRequest(this.formKey)
      ])
      this.currentItems = (itemsRes && itemsRes.data) || []
      this.currentForm = (formRes && formRes.data) || null
      this.currentFormJson = JSON.stringify(itemsToAiForm(this.currentItems, this.currentForm))
    },
    handleSend(text) {
      this.startAiWorkflow(text)
    },
    aiPlanScope() {
      return `form:${this.formKey}`
    },
    async beforeAiRequest(stage) {
      if (!this.formKey) throw new Error('缺少表单标识')
      await this.refreshCurrentForm()
      if (stage === 'generate') {
        this.baselineSignature = this.signature(this.currentItems)
      }
    },
    aiRequestMeta() {
      return { mode: 'revise', formKey: this.formKey }
    },
    aiCurrentForm() {
      return this.currentFormJson || null
    },
    signature(items) {
      return (items || [])
        .map((item) => `${item.formItemId}:${item.sort}:${item.label}:${item.type}`)
        .join('|')
    },
    onAiAssistantDone(assistant) {
      try {
        const repaired = jsonrepair(assistant.raw)
        const payload = parseAiPayload(repaired)
        if (!payload.questions.length) {
          if (payload.plan.length) {
            assistant.summary = 'AI 未返回可应用的题目变更'
            return
          }
          assistant.status = 'error'
          assistant.error = 'AI 未返回可用的表单方案，请重试。'
          assistant.retryable = true
          assistant.summary = '生成失败'
          return
        }
        const diff = diffAiForm(this.currentItems, payload.questions)
        this.$set(assistant, 'proposal', {
          plan: payload.plan || [],
          payload,
          diff
        })
        this.$set(assistant, 'proposalApplied', false)
        assistant.summary = `表单已生成：新增 ${diff.create.length}，修改 ${diff.update.length}，删除 ${diff.remove.length}`
      } catch (e) {
        assistant.status = 'error'
        assistant.error = 'AI 返回的表单格式不完整，请重试。'
        assistant.retryable = true
        assistant.summary = '生成失败'
      }
    },
    onAiAssistantError() {
      // 错误已在消息气泡中展示
    },
    onAiConversationReset() {
      this.baselineSignature = ''
      this.loadAiPlans()
      this.refreshCurrentForm().catch(() => {})
    },
    hasChanges(diff) {
      return !!(
        diff &&
        (diff.create.length || diff.update.length || diff.remove.length || diff.typeChanges.length)
      )
    },
    canApply(proposal) {
      if (!proposal || !proposal.payload || !proposal.diff) return false
      const form = this.currentForm || {}
      const titleChanged =
        !!proposal.payload.title && proposal.payload.title !== (form.name || form.title)
      const descriptionChanged =
        !!proposal.payload.description && proposal.payload.description !== (form.description || '')
      return this.hasChanges(proposal.diff) || titleChanged || descriptionChanged
    },
    async applyProposal(message) {
      if (this.applying || !message.proposal) return
      const proposal = message.proposal

      try {
        await this.refreshCurrentForm()
      } catch (e) {
        this.$message.error('读取当前表单失败，无法应用修改')
        return
      }
      if (this.baselineSignature && this.signature(this.currentItems) !== this.baselineSignature) {
        try {
          await this.$confirm(
            '表单在 AI 生成方案后已被修改，继续应用将覆盖这些修改，是否继续？',
            '表单已变化',
            { confirmButtonText: '继续应用', cancelButtonText: '取消', type: 'warning' }
          )
        } catch (e) {
          return
        }
      }

      try {
        const logic = await getFormLogicRequest({ formKey: this.formKey })
        if (logic && logic.data) {
          try {
            await this.$confirm(
              '该表单已配置逻辑，删除题目或改变题型可能导致逻辑失效，请应用后在「逻辑」页检查。',
              '注意',
              { confirmButtonText: '继续应用', cancelButtonText: '取消', type: 'warning' }
            )
          } catch (e) {
            return
          }
        }
      } catch (e) {
        // 逻辑查询失败不阻断应用
      }

      this.applying = true
      const loading = this.$loading({
        lock: true,
        text: '正在应用 AI 修改，请勿操作设计器...',
        background: 'rgba(255, 255, 255, 0.7)'
      })
      try {
        const result = await applyAiForm({
          formKey: this.formKey,
          currentItems: this.currentItems,
          proposed: proposal.payload,
          form: this.currentForm || {}
        })
        this.$set(message, 'proposalApplied', true)
        message.summary = `已应用：更新 ${result.updated}，新增 ${result.created}，删除 ${result.removed}`
        this.markAiPlanApplied()
        this.$message.success(
          `已应用：更新 ${result.updated}，新增 ${result.created}，删除 ${result.removed}`
        )
        if (result.orderWarning) this.$message.warning(result.orderWarning)
        this.$emit('applied', result)
        await this.refreshCurrentForm()
        this.baselineSignature = this.signature(this.currentItems)
      } catch (e) {
        this.$message.error((e && (e.msg || e.message)) || '应用修改失败')
      } finally {
        loading.close()
        this.applying = false
      }
    },
    discardProposal(message) {
      this.$set(message, 'proposal', null)
      message.summary = '已放弃本次修改'
    },
    restartConversation() {
      if (!this.aiMessages.length) return
      this.$confirm('重新开始将清空当前对话，是否继续？', '提示', {
        confirmButtonText: '重新开始',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => this.resetAiConversation())
        .catch(() => {})
    },
    goAiConfig() {
      this.$router.push({ path: '/manage/system', query: { tab: 'deepSeekEnvConfig' } })
    },
    startResize(event) {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = this.panelWidth
      this.resizeMoveHandler = (ev) => {
        const next = startWidth - (ev.clientX - startX)
        this.panelWidth = Math.min(420, Math.max(280, next))
      }
      this.resizeUpHandler = () => {
        localStorage.setItem(WIDTH_KEY, String(this.panelWidth))
        this.stopResize()
      }
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', this.resizeMoveHandler)
      document.addEventListener('mouseup', this.resizeUpHandler)
    },
    stopResize() {
      if (this.resizeMoveHandler) {
        document.removeEventListener('mousemove', this.resizeMoveHandler)
        this.resizeMoveHandler = null
      }
      if (this.resizeUpHandler) {
        document.removeEventListener('mouseup', this.resizeUpHandler)
        this.resizeUpHandler = null
      }
      document.body.style.cursor = ''
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-dock {
  display: flex;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  background: #fff;
  border-left: 1px solid #e5e9ef;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 8;
  overflow: hidden;
  box-sizing: border-box;

  .ai-resizer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 2;

    &:hover,
    &:active {
      background: #dbeafe;
    }
  }

  .designer-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    width: 100%;
    min-width: 0;
    padding-left: 6px;
    box-sizing: border-box;
  }

  .drawer-head {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 14px 10px;
    border-bottom: 1px solid #f1f5f9;

    .drawer-title h3 {
      margin: 0 0 4px;
      font-size: 16px;
      color: #1e293b;
    }

    .drawer-title p {
      margin: 0;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }

    .drawer-close {
      color: #94a3b8;
      font-size: 18px;
      padding: 0;
    }
  }
}

.ai-proposal {
  margin-top: 10px;
  padding: 10px;
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 10px;

  .ai-plan-title {
    font-size: 12px;
    font-weight: 600;
    color: #1d4ed8;
    margin-bottom: 6px;
  }

  .ai-plan ol {
    margin: 0 0 8px;
    padding-left: 18px;
    color: #334155;
    font-size: 12px;
    line-height: 1.7;
  }

  .ai-diff {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .ai-diff-chip {
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 18px;

    &.create {
      background: #ecfdf5;
      color: #047857;
    }

    &.update {
      background: #eff6ff;
      color: #1d4ed8;
    }

    &.remove {
      background: #fef2f2;
      color: #b91c1c;
    }

    &.keep {
      background: #f8fafc;
      color: #64748b;
    }
  }

  .ai-change-list {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 8px;
  }

  .ai-change {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 0;
    font-size: 12px;
    color: #334155;
    line-height: 1.5;
  }

  .ai-change-tag {
    flex-shrink: 0;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 18px;

    &.create {
      background: #ecfdf5;
      color: #047857;
    }

    &.update {
      background: #eff6ff;
      color: #1d4ed8;
    }

    &.remove {
      background: #fef2f2;
      color: #b91c1c;
    }
  }

  .ai-change-text {
    word-break: break-word;
  }

  .ai-proposal-actions {
    display: flex;
    gap: 8px;
  }

  .ai-proposal-tip {
    margin-top: 6px;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
  }

  .ai-applied {
    font-size: 12px;
    color: #047857;
  }
}
</style>
