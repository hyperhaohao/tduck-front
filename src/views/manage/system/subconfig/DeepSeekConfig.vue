<template>
  <div class="config-form-wrapper">
    <el-alert
      v-if="legacyModelWarning"
      type="warning"
      :closable="false"
      show-icon
      class="legacy-alert"
      title="检测到已停用的旧模型名"
      description="deepseek-chat / deepseek-reasoner 已于 2026-07-24 停用，请改为 deepseek-v4-flash / deepseek-v4-pro 后保存。"
    />

    <el-form ref="deepSeekEnvConfig" :model="form" label-position="top" class="modern-form">
      <el-form-item label="启用 AI 服务" prop="enabled">
        <el-switch v-model="form.enabled" class="modern-switch" @change="handleEnabledChange" />
        <div class="form-hint">开启后启用 AI 建表、深入思考与连续对话修正</div>
      </el-form-item>

      <template v-if="form.enabled">
        <el-form-item
          label="API Key"
          prop="apiKey"
          :rules="[{ required: true, message: '请输入 API Key', trigger: 'blur' }]"
        >
          <el-input v-model="form.apiKey" placeholder="例如：sk-..." show-password class="modern-input" />
          <div class="form-hint">
            从模型服务商获取。仅保存在服务端数据库，不写入日志；请勿发到聊天或提交到 Git。
          </div>
        </el-form-item>

        <el-form-item
          label="Base URL"
          prop="baseUrl"
          :rules="[
            { required: true, message: '请输入 Base URL', trigger: 'blur' },
            { pattern: /^https?:\/\/.+/, message: '请以 http:// 或 https:// 开头', trigger: 'blur' }
          ]"
        >
          <el-input v-model="form.baseUrl" placeholder="例如：https://api.deepseek.com/v1" class="modern-input" />
          <div class="form-hint">
            官方地址填 https://api.deepseek.com/v1；第三方 OpenAI 兼容网关填到 /v1 为止。
          </div>
        </el-form-item>

        <el-form-item
          label="普通模型"
          prop="modelName"
          :rules="[{ required: true, message: '请输入普通模型名称', trigger: 'blur' }]"
        >
          <el-input v-model="form.modelName" placeholder="deepseek-v4-flash" class="modern-input" />
          <div class="form-hint">日常生成使用；旧 deepseek-chat 已停用，默认 deepseek-v4-flash。</div>
        </el-form-item>

        <el-form-item
          label="深入思考模型"
          prop="reasoningModelName"
          :rules="[{ required: true, message: '请输入深入思考模型名称', trigger: 'blur' }]"
        >
          <el-input v-model="form.reasoningModelName" placeholder="deepseek-v4-pro" class="modern-input" />
          <div class="form-hint">
            仅开启“深入思考”时使用。官方域名会自动下发 thinking 与 reasoning_effort；第三方网关只切换模型名。
          </div>
        </el-form-item>

        <el-form-item label="思考强度" prop="reasoningEffort">
          <el-select v-model="form.reasoningEffort" class="modern-input" style="width: 100%">
            <el-option label="low（较快）" value="low" />
            <el-option label="high（推荐）" value="high" />
            <el-option label="max（最深入）" value="max" />
          </el-select>
          <div class="form-hint">仅官方 DeepSeek 域名生效，默认 high。</div>
        </el-form-item>

        <el-form-item label="请求超时时间（秒）" prop="timeout">
          <el-input-number v-model="form.timeout" :min="30" :max="600" class="modern-input" style="width: 100%" />
          <div class="form-hint">
            连接与流式读取超时，默认 300 秒；深入思考首字可能较慢，建议不低于 180 秒。Nginx 超时应大于该值。
          </div>
        </el-form-item>
      </template>

      <el-form-item class="form-action">
        <el-button type="primary" class="modern-btn" @click="handleSubmit"> 保 存 配 置 </el-button>
        <el-button class="modern-btn plain-btn" :loading="testing" :disabled="!form.enabled" @click="handleTest">
          测试连接
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import ConfigMixin from './ConfigMixin'
import { getEnvConfig, saveEnvConfig } from '@/api/mange/config'
import { testAiConnection } from '@/api/ai'

const DEFAULT_FORM = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  modelName: 'deepseek-v4-flash',
  reasoningModelName: 'deepseek-v4-pro',
  reasoningEffort: 'high',
  timeout: 300
}

export default {
  name: 'DeepseekEnvConfig',
  mixins: [ConfigMixin],
  data() {
    return {
      testing: false,
      legacyModelWarning: false,
      form: { ...DEFAULT_FORM }
    }
  },
  async created() {
    this.activeName = 'deepSeekEnvConfig'
    await this.handleClick()
  },
  methods: {
    async handleClick() {
      const res = await getEnvConfig(this.activeName)
      const envValue = (res.data && res.data.envValue) || {}
      this.config = res.data || {}
      this.form = Object.assign({}, DEFAULT_FORM, envValue)
      this.legacyModelWarning =
        this.form.modelName === 'deepseek-chat' ||
        this.form.reasoningModelName === 'deepseek-reasoner'
      if (this.form.modelName === 'deepseek-chat') {
        this.form.modelName = 'deepseek-v4-flash'
      }
      if (this.form.reasoningModelName === 'deepseek-reasoner') {
        this.form.reasoningModelName = 'deepseek-v4-pro'
      }
    },
    handleEnabledChange(val) {
      if (!val) {
        this.$refs.deepSeekEnvConfig.clearValidate()
      }
    },
    handleSubmit() {
      this.$refs.deepSeekEnvConfig.validate((valid) => {
        if (!valid) return
        this.config.envKey = this.activeName
        this.config.envValue = this.form
        saveEnvConfig(this.config).then(() => {
          this.msgSuccess('保存成功，配置已立即生效，无需重启')
          this.legacyModelWarning = false
        })
      })
    },
    async handleTest() {
      if (!this.config || !this.config.envKey) {
        this.$message.warning('请先保存配置，再测试连接')
        return
      }
      this.testing = true
      try {
        const res = await testAiConnection()
        const data = res.data || {}
        this.$message.success(
          `连接成功：${data.model || ''}${data.ms ? `（${data.ms}ms）` : ''}`
        )
      } catch (e) {
        this.$message.error((e && (e.msg || e.message)) || '连接失败，请检查 Key、Base URL 与模型名')
      } finally {
        this.testing = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.config-form-wrapper {
  max-width: 800px;
  margin-top: 32px;
  margin-left: 16px;
}

.legacy-alert {
  margin-bottom: 20px;
}

.modern-form {
  ::v-deep .el-form-item {
    margin-bottom: 28px;

    .el-form-item__label {
      font-weight: 600;
      color: #1e293b;
      padding-bottom: 8px;
      line-height: 1.4;
    }
  }

  .form-hint {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 6px;
    line-height: 1.5;
  }

  .form-action {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid #f1f5f9;
  }
}

.modern-input {
  ::v-deep .el-input__inner {
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    padding: 0 16px;
    height: 42px;
    line-height: 42px;
    transition: all 0.2s ease;
    font-size: 14px;
    color: #334155;

    &:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    &::placeholder {
      color: #94a3b8;
    }
  }

  ::v-deep .el-input-number__decrease,
  ::v-deep .el-input-number__increase {
    border-radius: 0 8px 8px 0;
    background-color: #f8fafc;
    border-left: 1px solid #cbd5e1;
    height: 40px;
    line-height: 40px;
  }

  ::v-deep .el-input-number__decrease {
    border-radius: 8px 0 0 8px;
    border-right: 1px solid #cbd5e1;
    border-left: none;
  }
}

.modern-btn {
  border-radius: 8px;
  font-weight: 500;
  padding: 12px 32px;
  font-size: 14px;
  transition: all 0.2s;
  border: none;

  &.el-button--primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);

    &:hover {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    }

    &:active {
      transform: translateY(1px);
    }
  }

  &.plain-btn {
    margin-left: 12px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #334155;

    &:hover {
      border-color: #3b82f6;
      color: #2563eb;
    }
  }
}
</style>
