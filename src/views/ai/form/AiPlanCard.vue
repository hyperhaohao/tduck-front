<template>
  <div class="ai-plan-card">
    <div class="ai-card-head">
      <div class="ai-card-title">
        <i class="el-icon-document"></i>
        {{ plan.title || '设计方案' }}
      </div>
      <span class="ai-plan-status" :class="'is-' + status">{{ statusLabel }}</span>
    </div>

    <div v-if="plan.description" class="ai-plan-desc">{{ plan.description }}</div>

    <div class="ai-plan-meta">
      <span v-if="plan.audience">目标：{{ plan.audience }}</span>
      <span v-if="plan.questionCount">{{ plan.questionCount }} 道题</span>
      <span v-if="typeMixText">{{ typeMixText }}</span>
    </div>

    <div v-if="plan.changeSummary && plan.changeSummary.length" class="ai-plan-section">
      <div class="ai-section-title">本次变更</div>
      <ul>
        <li v-for="(item, index) in plan.changeSummary" :key="'c' + index">{{ item }}</li>
      </ul>
    </div>

    <div v-if="active && status === 'draft'" class="ai-plan-actions">
      <el-button type="primary" size="mini" :loading="generating" @click="$emit('confirm')">
        确认并生成
      </el-button>
      <el-button size="mini" @click="adjusting = !adjusting">调整方案</el-button>
      <el-button type="text" size="mini" class="ai-plan-cancel" @click="$emit('cancel')">
        放弃
      </el-button>
    </div>

    <div v-if="active && status === 'draft' && adjusting" class="ai-plan-adjust">
      <el-input
        v-model="feedback"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="说明方案哪里需要调整，例如：题量减到 6 题，增加一道评分题"
      />
      <div class="ai-plan-adjust-actions">
        <el-button type="primary" size="mini" :disabled="!feedback.trim()" @click="submitAdjust">
          重新出方案
        </el-button>
        <el-button size="mini" @click="adjusting = false">取消</el-button>
      </div>
    </div>

    <div v-if="outline.length" class="ai-plan-section">
      <div class="ai-section-title">题目大纲（{{ outline.length }}）</div>
      <div class="ai-plan-outline">
        <div v-for="(item, index) in outline" :key="index" class="ai-outline-item">
          <span class="ai-outline-index">{{ index + 1 }}</span>
          <div class="ai-outline-body">
            <div class="ai-outline-title">
              <span class="ai-outline-type">{{ item.type || '题目' }}</span>
              {{ item.title || '' }}
            </div>
            <div v-if="item.options && item.options.length" class="ai-outline-options">
              {{ item.options.join(' / ') }}
            </div>
            <div v-if="item.reason" class="ai-outline-reason">{{ item.reason }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="plan.assumptions && plan.assumptions.length" class="ai-plan-section">
      <div class="ai-section-title">默认假设</div>
      <ul>
        <li v-for="(item, index) in plan.assumptions" :key="'a' + index">{{ item }}</li>
      </ul>
    </div>

    <div v-if="plan.risks && plan.risks.length" class="ai-plan-section ai-plan-risks">
      <div class="ai-section-title">风险与注意</div>
      <ul>
        <li v-for="(item, index) in plan.risks" :key="'r' + index">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
const STATUS_LABELS = {
  draft: '待确认',
  confirmed: '已确认',
  generated: '已生成',
  applied: '已应用',
  cancelled: '已放弃'
}

export default {
  name: 'AiPlanCard',
  props: {
    plan: { type: Object, default: () => ({}) },
    status: { type: String, default: 'draft' },
    active: { type: Boolean, default: true },
    generating: { type: Boolean, default: false }
  },
  data() {
    return {
      adjusting: false,
      feedback: ''
    }
  },
  computed: {
    statusLabel() {
      return STATUS_LABELS[this.status] || '待确认'
    },
    outline() {
      return Array.isArray(this.plan.outline) ? this.plan.outline : []
    },
    typeMixText() {
      const mix = this.plan.typeMix
      if (!mix || typeof mix !== 'object') return ''
      return Object.keys(mix)
        .map((key) => `${key} ${mix[key]}`)
        .join(' / ')
    }
  },
  methods: {
    submitAdjust() {
      const text = this.feedback.trim()
      if (!text) return
      this.feedback = ''
      this.adjusting = false
      this.$emit('revise', text)
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-plan-card {
  margin-top: 8px;
  padding: 10px;
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 10px;

  .ai-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .ai-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #1d4ed8;
    line-height: 1.5;
    word-break: break-word;
  }

  .ai-plan-status {
    flex-shrink: 0;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 18px;
    background: #f8fafc;
    color: #64748b;

    &.is-confirmed {
      background: #eff6ff;
      color: #1d4ed8;
    }

    &.is-generated {
      background: #ecfdf5;
      color: #047857;
    }

    &.is-applied {
      background: #ecfdf5;
      color: #047857;
    }

    &.is-cancelled {
      background: #f1f5f9;
      color: #94a3b8;
    }
  }

  .ai-plan-desc {
    font-size: 12px;
    color: #475569;
    line-height: 1.6;
    margin-bottom: 6px;
  }

  .ai-plan-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 11px;
    color: #64748b;
    margin-bottom: 8px;
  }

  .ai-plan-section {
    margin-bottom: 8px;

    .ai-section-title {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 4px;
    }

    ul {
      margin: 0;
      padding-left: 16px;
      color: #475569;
      font-size: 11px;
      line-height: 1.7;
    }

    &.ai-plan-risks ul {
      color: #b45309;
    }
  }

  .ai-plan-outline {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    padding: 6px 8px;
    background: #fcfdff;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 2px;
    }
  }

  .ai-outline-item {
    display: flex;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px dashed #f1f5f9;

    &:last-child {
      border-bottom: none;
    }
  }

  .ai-outline-index {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    line-height: 18px;
    text-align: center;
    border-radius: 50%;
    background: #eff6ff;
    color: #2563eb;
    font-size: 10px;
    margin-top: 1px;
  }

  .ai-outline-body {
    min-width: 0;
  }

  .ai-outline-title {
    font-size: 12px;
    color: #334155;
    line-height: 1.5;
    word-break: break-word;
  }

  .ai-outline-type {
    display: inline-block;
    padding: 0 5px;
    margin-right: 4px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 10px;
    line-height: 16px;
  }

  .ai-outline-options {
    margin-top: 2px;
    font-size: 11px;
    color: #64748b;
    line-height: 1.5;
  }

  .ai-outline-reason {
    margin-top: 1px;
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.5;
  }

  .ai-plan-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;

    .ai-plan-cancel {
      color: #94a3b8;
      padding: 0;
    }
  }

  .ai-plan-adjust {
    margin-top: 8px;

    ::v-deep .el-textarea__inner {
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.6;
    }

    .ai-plan-adjust-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
  }
}
</style>
