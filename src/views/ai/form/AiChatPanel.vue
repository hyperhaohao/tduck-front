<template>
  <div class="ai-chat-panel">
    <div v-if="status && status.configured === false" class="ai-status-alert">
      <i class="el-icon-warning-outline"></i>
      <div class="ai-status-text">
        <strong>AI 服务不可用</strong>
        <span>{{ status.message || statusError }}</span>
      </div>
      <el-button v-if="canConfig" type="text" class="ai-status-action" @click="$emit('config')">
        去配置
      </el-button>
    </div>
    <div v-else-if="statusError" class="ai-status-alert">
      <i class="el-icon-warning-outline"></i>
      <div class="ai-status-text">
        <strong>无法检查 AI 服务</strong>
        <span>{{ statusError }}</span>
      </div>
    </div>

    <div ref="list" class="ai-message-list">
      <div v-if="!messages.length" class="ai-empty">
        <p class="ai-empty-title">{{ emptyTitle }}</p>
        <p class="ai-empty-hint">{{ emptyHint }}</p>
        <div v-if="examples && examples.length" class="ai-examples">
          <div
            v-for="(example, index) in examples"
            :key="index"
            class="ai-example"
            @click="fillExample(example)"
          >
            {{ example.content || example }}
          </div>
        </div>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="ai-msg" :class="msg.role">
        <div class="ai-bubble">
          <div v-if="msg.role === 'user'" class="ai-text">{{ msg.content }}</div>

          <template v-else>
            <div v-if="msg.thinking" class="ai-thinking">
              <div class="ai-thinking-toggle" @click="toggleThinking(msg.id)">
                <i :class="thinkingOpen[msg.id] ? 'el-icon-arrow-down' : 'el-icon-arrow-right'" />
                <span>思考过程</span>
                <span class="ai-thinking-count">{{ msg.thinking.length }} 字</span>
              </div>
              <pre v-show="thinkingOpen[msg.id]" class="ai-thinking-body">{{ msg.thinking }}</pre>
            </div>

            <div v-if="msg.status === 'streaming'" class="ai-streaming">
              <span class="ai-wave"><i /><i /><i /></span>
              {{ msg.thinking && !msg.text ? 'AI 正在深入思考…' : 'AI 正在生成…' }}
            </div>

            <div v-if="msg.text" class="ai-raw-toggle" @click="toggleRaw(msg.id)">
              <i :class="rawOpen[msg.id] ? 'el-icon-arrow-down' : 'el-icon-arrow-right'" />
              {{ rawOpen[msg.id] ? '收起原始输出' : '查看原始输出' }}
            </div>
            <pre v-if="msg.text && rawOpen[msg.id]" class="ai-raw-body">{{ msg.text }}</pre>

            <ai-clarify-card
              v-if="msg.clarifyActive && msg.clarify"
              :payload="msg.clarify"
              @submit="$emit('clarify-submit', $event)"
              @skip="$emit('clarify-skip')"
            />
            <div
              v-if="msg.planPayload"
              class="ai-plan-anchor"
              :data-plan-message="msg.id"
            >
              <ai-plan-card
                :plan="msg.planPayload"
                :status="msg.planStatus || 'draft'"
                :active="msg.planActive"
                :generating="streaming && msg.planStatus === 'confirmed'"
                @confirm="$emit('plan-confirm', msg)"
                @revise="$emit('plan-revise', $event)"
                @cancel="$emit('plan-cancel', msg)"
              />
            </div>

            <slot name="assistant-extra" :message="msg" />

            <div v-if="msg.summary" class="ai-summary">{{ msg.summary }}</div>

            <div v-if="msg.status === 'error'" class="ai-error">
              <span>{{ msg.error || 'AI 请求失败' }}</span>
              <el-button v-if="msg.retryable" type="text" size="mini" @click="$emit('retry', msg)">
                重试
              </el-button>
            </div>
            <div v-if="msg.status === 'stopped'" class="ai-stopped">已停止生成</div>
          </template>
        </div>
      </div>
    </div>

    <div class="ai-input-area">
      <div class="ai-input-toolbar">
        <div class="ai-mode-switch">
          <el-radio-group
            :value="workflowMode"
            size="mini"
            :disabled="streaming"
            @input="$emit('update:workflowMode', $event)"
          >
            <el-radio-button label="plan">方案模式</el-radio-button>
            <el-radio-button label="quick">快速生成</el-radio-button>
          </el-radio-group>
        </div>
        <div class="ai-toolbar-right">
          <el-button type="text" size="mini" class="ai-plan-history-btn" @click="planHistoryVisible = true">
            方案记录
          </el-button>
          <label class="ai-thinking-switch">
            <el-switch
              :value="thinking"
              :disabled="streaming"
              size="small"
              @change="$emit('update:thinking', $event)"
            />
            <span>深入思考</span>
          </label>
        </div>
      </div>
      <el-input
        ref="input"
        v-model="draft"
        class="ai-textarea"
        type="textarea"
        :rows="3"
        resize="none"
        :disabled="disabled || (status && status.configured === false)"
        :placeholder="placeholder"
        @keydown.native.enter.exact.prevent="onSend"
      />
      <div class="ai-input-footer">
        <span class="ai-input-hint">Enter 发送</span>
        <span class="ai-input-count">{{ draft.length }}/4000</span>
        <el-button
          v-if="!streaming"
          type="primary"
          class="ai-send-btn"
          :disabled="disabled || !draft.trim() || (status && status.configured === false)"
          @click="onSend"
        >
          发送
        </el-button>
        <el-button v-else type="danger" plain class="ai-stop-btn" @click="$emit('stop')">
          停止生成
        </el-button>
        <el-button
          v-if="messages.length && !streaming"
          type="text"
          class="ai-reset-btn"
          @click="$emit('reset')"
        >
          重新开始
        </el-button>
      </div>
    </div>

    <el-dialog
      title="方案记录"
      :visible.sync="planHistoryVisible"
      width="520px"
      append-to-body
      custom-class="ai-plan-history-dialog"
    >
      <div v-if="!savedPlans.length" class="ai-plan-history-empty">
        暂无保存的方案。方案模式生成方案后会自动保存在本浏览器。
      </div>
      <div
        v-for="plan in savedPlans"
        :key="plan.planId"
        class="ai-plan-history-item"
      >
        <div class="ai-plan-history-main">
          <div class="ai-plan-history-title">{{ plan.title || '未命名方案' }}</div>
          <div class="ai-plan-history-meta">
            {{ formatPlanTime(plan.savedAt) }} · {{ statusLabel(plan.status) }}
          </div>
        </div>
        <el-button type="text" size="mini" @click="copyPlan(plan)">复制 Markdown</el-button>
      </div>
      <div class="ai-plan-history-tip">方案仅保存在当前浏览器，不跨设备同步。</div>
    </el-dialog>
  </div>
</template>

<script>
import AiClarifyCard from './AiClarifyCard.vue'
import AiPlanCard from './AiPlanCard.vue'
import { planToMarkdown } from './planStore'

const PLAN_STATUS_LABELS = {
  draft: '待确认',
  confirmed: '已确认',
  generated: '已生成',
  applied: '已应用',
  cancelled: '已放弃'
}

export default {
  name: 'AiChatPanel',
  components: { AiClarifyCard, AiPlanCard },
  props: {
    messages: { type: Array, default: () => [] },
    status: { type: Object, default: null },
    statusError: { type: String, default: '' },
    streaming: { type: Boolean, default: false },
    thinking: { type: Boolean, default: false },
    workflowMode: { type: String, default: 'plan' },
    savedPlans: { type: Array, default: () => [] },
    planStatus: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    canConfig: { type: Boolean, default: false },
    placeholder: {
      type: String,
      default: '例如：把第 2 题改成多选，并新增一道数字题'
    },
    emptyTitle: { type: String, default: '输入您的需求，AI 将为您构建表单' },
    emptyHint: {
      type: String,
      default: '生成后可以继续对话修改，例如“把第 2 题改成多选”'
    },
    examples: { type: Array, default: () => [] }
  },
  data() {
    return {
      draft: '',
      thinkingOpen: {},
      rawOpen: {},
      planHistoryVisible: false
    }
  },
  watch: {
    messages: {
      deep: true,
      handler() {
        this.scrollToLatest()
      }
    },
    streaming() {
      this.scrollToLatest()
    }
  },
  methods: {
    onSend() {
      const text = this.draft.trim()
      if (!text || this.streaming || this.disabled) return
      if (this.status && this.status.configured === false) return
      this.draft = ''
      this.$emit('send', text)
    },
    fillExample(example) {
      this.draft = (example && example.content) || example || ''
      this.$nextTick(() => {
        const input = this.$refs.input
        if (input && input.focus) input.focus()
      })
    },
    toggleThinking(id) {
      this.$set(this.thinkingOpen, id, !this.thinkingOpen[id])
    },
    toggleRaw(id) {
      this.$set(this.rawOpen, id, !this.rawOpen[id])
    },
    copyPlan(plan) {
      const text = planToMarkdown(plan)
      if (!text) return
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => this.$message.success('方案已复制为 Markdown'))
          .catch(() => this.fallbackCopy(text))
      } else {
        this.fallbackCopy(text)
      }
    },
    fallbackCopy(text) {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
        this.$message.success('方案已复制为 Markdown')
      } catch (e) {
        this.$message.error('复制失败，请手动选择文本')
      }
      document.body.removeChild(area)
    },
    formatPlanTime(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString('zh-CN', { hour12: false })
    },
    statusLabel(status) {
      return PLAN_STATUS_LABELS[status] || '待确认'
    },
    scrollToLatest() {
      this.$nextTick(() => {
        const last = this.messages[this.messages.length - 1]
        if (last && last.planPayload) {
          const anchor = this.$el.querySelector(`[data-plan-message="${last.id}"]`)
          if (anchor) {
            anchor.scrollIntoView({ block: 'start' })
            return
          }
        }
        this.scrollToBottom()
      })
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const list = this.$refs.list
        if (list) list.scrollTop = list.scrollHeight
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.ai-status-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 20px 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.5;

  i {
    font-size: 18px;
    color: #f59e0b;
    margin-top: 1px;
  }

  .ai-status-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    strong {
      font-size: 13px;
    }

    span {
      word-break: break-word;
    }
  }

  .ai-status-action {
    color: #c2410c;
    padding: 0;
  }
}

.ai-message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 20px 12px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 2px;
  }
}

.ai-empty {
  padding: 18px 4px;

  .ai-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #334155;
    margin: 0 0 6px;
  }

  .ai-empty-hint {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 14px;
    line-height: 1.6;
  }

  .ai-examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-example {
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 13px;
    color: #475569;
    line-height: 1.5;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #fff;
      border-color: #3b82f6;
      color: #2563eb;
    }
  }
}

.ai-msg {
  display: flex;
  margin-bottom: 12px;

  &.user {
    justify-content: flex-end;

    .ai-bubble {
      background: #2563eb;
      color: #fff;
      border-radius: 12px 12px 2px 12px;
      max-width: 88%;
    }
  }

  &.assistant {
    justify-content: flex-start;

    .ai-bubble {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px 12px 12px 2px;
      max-width: 94%;
    }
  }

  .ai-bubble {
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
    min-width: 0;
  }

  .ai-text {
    white-space: pre-wrap;
  }
}

.ai-thinking {
  margin-bottom: 8px;

  .ai-thinking-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  .ai-thinking-count {
    color: #94a3b8;
    margin-left: auto;
  }

  .ai-thinking-body {
    margin: 6px 0 0;
    padding: 8px 10px;
    max-height: 180px;
    overflow: auto;
    background: #fff;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    color: #475569;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.ai-streaming {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;

  .ai-wave {
    display: inline-flex;
    gap: 3px;

    i {
      width: 3px;
      height: 10px;
      border-radius: 2px;
      background: #3b82f6;
      animation: ai-wave 1s ease-in-out infinite;

      &:nth-child(2) {
        animation-delay: 0.12s;
      }

      &:nth-child(3) {
        animation-delay: 0.24s;
      }
    }
  }
}

.ai-raw-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.ai-raw-body {
  margin: 6px 0 0;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-summary {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.ai-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
  flex-wrap: wrap;
}

.ai-stopped {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.ai-input-area {
  flex-shrink: 0;
  padding: 10px 20px 16px;
  border-top: 1px solid #f1f5f9;
  background: #fff;

  .ai-input-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
    min-height: 26px;
  }

  .ai-mode-switch {
    ::v-deep .el-radio-button__inner {
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 0;
    }

    ::v-deep .el-radio-button:first-child .el-radio-button__inner {
      border-radius: 6px 0 0 6px;
    }

    ::v-deep .el-radio-button:last-child .el-radio-button__inner {
      border-radius: 0 6px 6px 0;
    }
  }

  .ai-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ai-plan-history-btn {
    padding: 0;
    color: #64748b;
    font-size: 11px;
  }

  .ai-thinking-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    user-select: none;
  }

  .ai-textarea {
    ::v-deep .el-textarea__inner {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.6;
      resize: none;

      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
    }
  }

  .ai-input-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .ai-input-hint {
    font-size: 11px;
    color: #94a3b8;
    flex: 1;
    min-width: 120px;
  }

  .ai-input-count {
    font-size: 11px;
    color: #94a3b8;
  }

  .ai-send-btn,
  .ai-stop-btn {
    height: 36px;
    min-width: 84px;
    border-radius: 8px;
    font-weight: 600;
  }

  .ai-reset-btn {
    padding: 0;
    color: #64748b;
  }
}

@keyframes ai-wave {
  0%,
  100% {
    height: 6px;
  }
  50% {
    height: 16px;
  }
}
</style>

<style lang="scss">
.ai-plan-history-dialog {
  .ai-plan-history-empty {
    padding: 18px 0;
    text-align: center;
    color: #94a3b8;
    font-size: 13px;
  }

  .ai-plan-history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #f1f5f9;

    &:last-of-type {
      border-bottom: none;
    }
  }

  .ai-plan-history-main {
    min-width: 0;
  }

  .ai-plan-history-title {
    font-size: 13px;
    color: #334155;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ai-plan-history-meta {
    margin-top: 3px;
    font-size: 11px;
    color: #94a3b8;
  }

  .ai-plan-history-tip {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed #e2e8f0;
    font-size: 11px;
    color: #94a3b8;
  }
}
</style>
