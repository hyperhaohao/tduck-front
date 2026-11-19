<template>
  <div class="ai-clarify-card">
    <div class="ai-card-title">
      <i class="el-icon-chat-line-square"></i>
      需要先确认几个问题
    </div>
    <div v-for="(question, index) in questions" :key="question.id || index" class="ai-question">
      <div class="ai-question-title">{{ index + 1 }}. {{ question.question }}</div>
      <div v-if="question.options && question.options.length" class="ai-options">
        <div
          v-for="option in question.options"
          :key="option"
          class="ai-option"
          :class="{ active: answers[question.id] === option }"
          @click="selectOption(question, option)"
        >
          {{ option }}
        </div>
      </div>
      <el-input
        v-model="custom[question.id]"
        class="ai-custom-input"
        size="small"
        placeholder="或输入其他答案"
        @input="clearOption(question)"
      />
    </div>
    <div v-if="payload.defaults" class="ai-defaults">
      <span class="ai-defaults-label">默认：</span>{{ payload.defaults }}
    </div>
    <div class="ai-card-actions">
      <el-button type="primary" size="mini" @click="submit">提交答案</el-button>
      <el-button size="mini" @click="$emit('skip')">跳过，按默认</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AiClarifyCard',
  props: {
    payload: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      answers: {},
      custom: {}
    }
  },
  computed: {
    questions() {
      const list = this.payload && this.payload.questions
      return Array.isArray(list) ? list : []
    }
  },
  methods: {
    selectOption(question, option) {
      this.$set(this.answers, question.id, option)
      this.$set(this.custom, question.id, '')
    },
    clearOption(question) {
      if (this.custom[question.id]) {
        this.$set(this.answers, question.id, '')
      }
    },
    submit() {
      const answers = this.questions.map((question) => {
        const custom = (this.custom[question.id] || '').trim()
        return {
          question: question.question,
          answer: custom || this.answers[question.id] || ''
        }
      })
      if (!answers.some((item) => item.answer)) {
        this.$message.warning('请至少回答一个问题，或选择跳过')
        return
      }
      this.$emit('submit', { answers })
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-clarify-card {
  margin-top: 8px;
  padding: 10px;
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 10px;

  .ai-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #1d4ed8;
    margin-bottom: 8px;
  }

  .ai-question {
    margin-bottom: 10px;

    &:last-of-type {
      margin-bottom: 6px;
    }
  }

  .ai-question-title {
    font-size: 12px;
    color: #334155;
    line-height: 1.6;
    margin-bottom: 6px;
  }

  .ai-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .ai-option {
    padding: 4px 9px;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;

    &:hover {
      border-color: #3b82f6;
      color: #2563eb;
    }

    &.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      font-weight: 600;
    }
  }

  .ai-custom-input {
    ::v-deep .el-input__inner {
      height: 30px;
      line-height: 30px;
      border-radius: 8px;
      font-size: 12px;
    }
  }

  .ai-defaults {
    padding: 7px 9px;
    background: #f8fafc;
    border-radius: 8px;
    font-size: 11px;
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 8px;

    .ai-defaults-label {
      color: #94a3b8;
    }
  }

  .ai-card-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
