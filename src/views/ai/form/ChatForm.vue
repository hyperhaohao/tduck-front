<template>
  <div class="chat-form-container">
    <div class="control-section">
      <div class="section-head">
        <div class="section-title-box">
          <h2>AI 智能构建表单</h2>
          <span v-if="aiStatus && aiStatus.configured" class="model-chip">{{ aiStatus.modelName }}</span>
        </div>
        <div v-if="aiHistoryTrimmed" class="history-tip">对话较长，已自动精简历史</div>
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
        :examples="examples"
        empty-title="输入您的需求，AI 将为您设计方案"
        empty-hint="方案模式会先澄清需求、给出方案，确认后再生成完整表单"
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
      />
    </div>

    <div class="preview-section">
      <div class="preview-toolbar">
        <div class="toolbar-left">
          <span :class="{ 'is-active': aiStreaming }" class="status-dot"></span>
          <span class="status-text">
            {{ aiStreaming ? 'AI 正在输出内容...' : fields.length ? '预览已就绪' : '等待生成' }}
          </span>
        </div>
        <div class="toolbar-right">
          <el-button
            :disabled="!fields.length || aiStreaming || isSaving"
            :loading="isSaving"
            class="save-form-btn"
            type="primary"
            @click="saveForm"
          >
            <i class="el-icon-circle-check mr5"></i>
            保存表单
          </el-button>
          <el-divider direction="vertical" />
          <el-button class="close-toolbar-btn" @click="$emit('close')">关闭</el-button>
        </div>
      </div>

      <div id="survey-content" class="preview-canvas">
        <div v-if="fields.length" class="phone-mockup">
          <div class="mockup-content">
            <FormPreview :fields="fields" :form-info="formInfo" />
          </div>
        </div>
        <div v-else class="empty-preview">
          <div v-if="!aiStreaming" class="waiting-box">
            <p>请在左侧描述您的需求，AI 将生成表单预览</p>
          </div>
          <div v-else class="generating-box">
            <div class="ai-wave">
              <span></span><span></span><span></span><span></span>
            </div>
            <p>AI 正在为您构建表单...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { throttle } from 'lodash'
import { jsonrepair } from 'jsonrepair'
import AiChatPanel from './AiChatPanel.vue'
import FormPreview from './FormPreview.vue'
import aiChatMixin from './aiChatMixin'
import { parseJsonToFields } from './convertToFields'
import { formItemConvertData } from './formBridge'
import { createFormRequest, batchCreateProjectItem } from '@/api/project/form'
import { demandState } from '@/utils/demand'

export default {
  name: 'ChatForm',
  components: {
    AiChatPanel,
    FormPreview
  },
  mixins: [aiChatMixin],
  data() {
    return {
      fields: [],
      formInfo: { title: '', description: '', type: 1 },
      isSaving: false,
      savedFormKey: '',
      savedFieldsSnapshot: '',
      savedItemsSnapshot: '',
      examples: [
        { content: '写一份关于远程办公体验的调查问卷，共 5 个问题，关注工作效率、沟通方式、居家环境等。' },
        {
          content:
            '请生成一份针对大学生日常学习习惯的调查问卷，包含 10 个问题，涵盖学习时间安排、学习方法使用、学习环境选择等方面，问题类型包括单选和多选。'
        },
        {
          content:
            '需要一份关于职场人士工作压力的调查问卷，包含 5 个问题，主要调查工作强度、加班频率、压力来源、压力应对方式等内容。'
        },
        {
          content:
            '创建一份关于消费者网购行为的调查问卷，包含 5 个问题，调查网购频率、选择平台考虑因素、支付方式偏好等方面。'
        },
        { content: '创建一份关于消费者对健康食品认知的调查问卷，共 10 个问题，关注购买习惯、标签认知、品牌信任等。' }
      ]
    }
  },
  computed: {
    isGlobalAdmin() {
      return !demandState.enabled || demandState.global
    }
  },
  created() {
    this.livePreview = throttle(this.applyStreamingPreview, 500)
    this.loadAiStatus()
    this.loadAiPlans()
  },
  beforeDestroy() {
    if (this.livePreview && this.livePreview.cancel) this.livePreview.cancel()
  },
  methods: {
    handleSend(text) {
      this.startAiWorkflow(text)
    },
    aiPlanScope() {
      return 'create'
    },
    aiCurrentForm() {
      const last = [...this.aiMessages]
        .reverse()
        .find((msg) => msg.role === 'assistant' && msg.status === 'done' && msg.raw)
      return (last && last.raw) || null
    },
    onAiContentDelta(delta, assistant) {
      // 只有生成阶段才实时预览；澄清/方案阶段的 JSON 不是表单
      if (assistant && assistant.stage !== 'generate') return
      const userCount = this.aiMessages.filter((msg) => msg.role === 'user').length
      if (userCount <= 1) this.livePreview()
    },
    applyStreamingPreview() {
      const msg = this.aiMessages.find(
        (item) => item.role === 'assistant' && item.status === 'streaming'
      )
      if (!msg || !msg.text) return
      try {
        const repaired = jsonrepair(msg.text)
        const parsed = parseJsonToFields(repaired)
        if (parsed.fields.length) {
          this.fields = parsed.fields
          if (parsed.formInfo && (parsed.formInfo.title || parsed.formInfo.description)) {
            this.formInfo = { ...this.formInfo, ...parsed.formInfo, type: 1 }
          }
        }
      } catch (e) {
        // 流式 JSON 尚不完整，忽略
      }
    },
    onAiAssistantDone(assistant) {
      try {
        const repaired = jsonrepair(assistant.raw)
        const parsed = parseJsonToFields(repaired)
        if (!parsed.fields.length) {
          assistant.status = 'error'
          assistant.error = 'AI 返回的表单无法解析，请重试。'
          assistant.retryable = true
          assistant.summary = '生成失败'
          return
        }
        this.fields = parsed.fields
        this.formInfo = {
          title: parsed.formInfo.title || 'AI 生成表单',
          description: parsed.formInfo.description || '',
          type: 1
        }
        assistant.summary = `已生成 ${parsed.fields.length} 道题目`
        this.savedFormKey = ''
        this.savedFieldsSnapshot = ''
        this.savedItemsSnapshot = ''
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
      this.fields = []
      this.formInfo = { title: '', description: '', type: 1 }
      this.savedFormKey = ''
      this.savedFieldsSnapshot = ''
      this.savedItemsSnapshot = ''
    },
    restartConversation() {
      if (!this.aiMessages.length && !this.fields.length) return
      this.$confirm('重新开始将清空当前对话和预览，是否继续？', '提示', {
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
    async saveForm() {
      if (!this.fields.length || this.aiStreaming || this.isSaving) return
      const name = (this.formInfo && this.formInfo.title) || 'AI 生成表单'
      if (this.fields.some((item) => !item.config)) {
        this.$message.error('表单数据不完整，请重新生成')
        return
      }
      this.isSaving = true
      const loading = this.$loading({
        lock: true,
        text: '正在保存并导入表单...',
        background: 'rgba(255, 255, 255, 0.7)'
      })
      try {
        const snapshot = JSON.stringify(this.fields)
        let formKey = this.savedFormKey
        if (formKey && snapshot === this.savedItemsSnapshot) {
          loading.close()
          this.isSaving = false
          this.confirmJump(formKey)
          return
        }
        if (!formKey || snapshot !== this.savedFieldsSnapshot) {
          const res = await createFormRequest({
            name,
            type: 1,
            description: this.formInfo.description,
            fields: this.fields
          })
          formKey = res.data.formKey
          this.savedFormKey = formKey
          this.savedFieldsSnapshot = snapshot
        }
        try {
          await batchCreateProjectItem(
            this.fields.map((item) => formItemConvertData(item, formKey))
          )
          this.savedItemsSnapshot = snapshot
        } catch (e) {
          loading.close()
          this.isSaving = false
          this.promptRetryImport(e)
          return
        }
        loading.close()
        this.isSaving = false
        this.confirmJump(formKey)
      } catch (e) {
        loading.close()
        this.isSaving = false
        this.$message.error((e && (e.msg || e.message)) || '保存表单失败')
      }
    },
    confirmJump(formKey) {
      this.$confirm('表单保存成功，是否立即前往设计器继续调整？', '提示', {
        confirmButtonText: '前往设计器',
        cancelButtonText: '留在当前页',
        type: 'success'
      })
        .then(() => {
          this.savedFormKey = ''
          this.savedFieldsSnapshot = ''
          this.savedItemsSnapshot = ''
          this.$router.push({
            path: '/project/form/editor',
            query: { key: formKey, ai: 1 }
          })
        })
        .catch(() => {})
    },
    promptRetryImport() {
      this.$msgbox({
        title: '题目导入失败',
        message: '表单已创建，但题目导入失败。重试只会重新导入题目，不会重复创建表单。',
        showCancelButton: true,
        confirmButtonText: '重试导入',
        cancelButtonText: '稍后处理',
        type: 'warning'
      })
        .then(() => this.retryImport())
        .catch(() => {})
    },
    async retryImport() {
      if (!this.savedFormKey) return
      const loading = this.$loading({
        lock: true,
        text: '正在重新导入题目...',
        background: 'rgba(255, 255, 255, 0.7)'
      })
      try {
        await batchCreateProjectItem(
          this.fields.map((item) => formItemConvertData(item, this.savedFormKey))
        )
        this.savedItemsSnapshot = this.savedFieldsSnapshot
        loading.close()
        this.$message.success('题目导入成功')
      } catch (e) {
        loading.close()
        this.$message.error((e && (e.msg || e.message)) || '题目导入仍然失败')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-form-container {
  display: flex;
  height: 100%;
  min-height: 0;
  background: #f8fafc;
  overflow: hidden;

  .control-section {
    width: 40%;
    min-width: 360px;
    max-width: 560px;
    background: #fff;
    border-right: 1px solid #e5e9ef;
    display: flex;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.02);
    z-index: 10;

    .section-head {
      flex-shrink: 0;
      padding: 20px 20px 10px;
    }

    .section-title-box {
      display: flex;
      align-items: center;
      gap: 10px;

      h2 {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
      }

      .model-chip {
        padding: 2px 8px;
        border-radius: 999px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 11px;
        line-height: 18px;
        white-space: nowrap;
      }
    }

    .history-tip {
      margin-top: 6px;
      font-size: 12px;
      color: #f59e0b;
    }
  }

  .preview-section {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #f8fafc;

    .preview-toolbar {
      height: 60px;
      flex-shrink: 0;
      padding: 0 20px;
      background: #fff;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #cbd5e0;
        flex-shrink: 0;

        &.is-active {
          background: #10b981;
          animation: pulse 2s infinite;
        }
      }

      .status-text {
        font-size: 12px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .save-form-btn {
        height: 36px;
        border-radius: 8px;
        font-weight: 600;
        padding: 0 18px;
      }
    }

    .preview-canvas {
      flex: 1;
      min-height: 0;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      position: relative;

      .phone-mockup {
        width: 100%;
        max-width: 850px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        padding: 22px;
        box-sizing: border-box;
        border: 1px solid #f1f5f9;
        margin: 0 auto;
      }
    }
  }
}

.empty-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  min-height: 300px;

  .waiting-box p {
    font-size: 15px;
    color: #616161;
    margin-bottom: 6px;
  }

  .generating-box {
    p {
      font-size: 14px;
      color: #3b82f6;
      font-weight: 500;
    }

    .ai-wave {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin-bottom: 12px;

      span {
        width: 3px;
        height: 12px;
        background: #3b82f6;
        border-radius: 2px;
        animation: wave 1s ease-in-out infinite;

        &:nth-child(2) {
          animation-delay: 0.1s;
        }

        &:nth-child(3) {
          animation-delay: 0.2s;
        }

        &:nth-child(4) {
          animation-delay: 0.3s;
        }
      }
    }
  }
}

@media (max-width: 1200px) {
  .chat-form-container {
    .control-section {
      width: 42%;
      min-width: 340px;
    }
  }
}

@media (max-width: 900px) {
  .chat-form-container {
    .control-section {
      width: 46%;
      min-width: 320px;
    }
  }
}

@media (max-height: 700px) {
  .chat-form-container .preview-section .preview-toolbar {
    height: 52px;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@keyframes wave {
  0%,
  100% {
    height: 6px;
  }
  50% {
    height: 18px;
  }
}
</style>
