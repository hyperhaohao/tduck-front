<template>
  <el-drawer
    :visible.sync="visible"
    :title="detail ? '需求详情 · ' + detail.requestNo : '需求详情'"
    :size="mobile ? '100%' : '760px'"
    :close-on-click-modal="false"
    :destroy-on-close="true"
    custom-class="demand-detail-drawer"
  >
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="detail">
        <h2 class="detail-title">{{ detail.title }}</h2>
        <p class="demand-muted">
          填报者：{{ detail.submitterName }} · {{ date(detail.createTime) }}
          <el-tag v-if="detail.submittedBy" size="mini" type="info">后台代录</el-tag>
        </p>
        <div class="demand-tags">
          <el-tag>{{ decisions[detail.decision] }}</el-tag
          ><el-tag v-if="detail.progress !== 'NONE'" type="info">{{ progresses[detail.progress] }}</el-tag>
        </div>
        <section class="original-fields">
          <div v-for="field in displayFields" :key="field.key" class="original-field">
            <span class="field-label">{{ field.label }}</span>
            <div class="field-content">
              <template v-if="field.files.length"
                ><el-button
                  v-for="(file, index) in field.files"
                  :key="index"
                  type="text"
                  icon="el-icon-paperclip"
                  @click="download(file)"
                  >{{ file.name || '下载附件' }}</el-button
                ></template
              ><span v-else class="demand-preline">{{ field.text }}</span>
            </div>
          </div>
        </section>
        <el-tabs v-model="tab"
          ><el-tab-pane label="回复与进度" name="replies"
            ><el-alert
              v-if="staff && detail.followupPending"
              class="followup-notice"
              title="填报者已追问，请发布正式回复"
              type="warning"
              :closable="false"
            /><div v-if="detail.reason" class="outcome-summary">
              <strong>采纳说明</strong>
              <p class="demand-preline">{{ detail.reason }}</p>
              <template v-if="detail.completion"
                ><strong>完成说明</strong>
                <p class="demand-preline">{{ detail.completion }}</p></template
              >
            </div>
            <el-timeline
              ><el-timeline-item
                v-for="item in replies"
                :key="item.id"
                :timestamp="date(item.createTime)"
                placement="top"
                ><div class="message-author">
                  {{ item.authorName }}
                  <el-tag v-if="item.kind === 'EVENT'" size="mini" type="info">进度更新</el-tag>
                  <el-tag v-else-if="item.kind === 'FOLLOWUP'" size="mini" type="warning">填报者追问</el-tag>
                </div>
                <p class="demand-preline">{{ item.content }}</p></el-timeline-item
              ></el-timeline
            >
            <p v-if="!replies.length" class="demand-muted">暂无正式回复，处理后将在这里展示。</p></el-tab-pane
          ><el-tab-pane v-if="staff" label="内部备注" name="notes"
            ><el-alert title="仅管理人员可见，不展示给填报者及公示读者。" type="info" :closable="false" />
            <article v-for="item in notes" :key="item.id" class="internal-message">
              <small>{{ item.authorName }} · {{ date(item.createTime) }}</small>
              <p class="demand-preline">{{ item.content }}</p>
            </article>
            <p v-if="!notes.length" class="demand-muted">
              暂无内部备注。内部备注仅管理人员可见，不会展示给填报者。
            </p></el-tab-pane
          ><el-tab-pane v-if="staff" label="操作记录" name="audit"
            ><article v-for="item in audits" :key="item.id" class="internal-message">
              <small>{{ item.authorName }} · {{ date(item.createTime) }}</small>
              <p class="demand-preline">{{ item.content }}</p>
            </article>
            <p v-if="!audits.length" class="demand-muted">
              暂无操作记录。分派经办人、发布/撤回/归档/删除公示等管理操作会记录在这里；处理结果更新和正式回复在「回复与进度」中展示。
            </p></el-tab-pane
          ></el-tabs
        >
        <section v-if="detail.canFollowUp" class="detail-section">
          <h3>追问经办人</h3>
          <p class="demand-muted">
            提交后会回到经办人的待我处理，经办人回复后可在「回复与进度」查看。
          </p>
          <el-input
            v-model="followupText"
            type="textarea"
            :rows="4"
            maxlength="10000"
            show-word-limit
            placeholder="补充说明或追问内容"
          />
          <div class="detail-actions">
            <el-button type="primary" :loading="saving" @click="submitFollowUp">提交追问</el-button>
          </div>
          <el-alert
            v-if="detail.followupPending"
            class="followup-waiting"
            title="已提交追问，等待经办人回复。"
            type="warning"
            :closable="false"
          />
        </section>
        <section v-if="detail.canAssign" class="detail-section">
          <h3>经办分派</h3>
          <div class="assign-controls">
            <el-select v-model="handlerId" placeholder="选择已授权经办人" filterable clearable
              ><el-option
                v-for="member in handlers"
                :key="member.userId"
                :label="member.name"
                :value="member.userId" /></el-select
            >
          </div>
          <div class="detail-actions">
            <el-button :loading="saving" @click="saveAssign">保存分派</el-button>
          </div>
        </section>
        <section v-if="detail.canHandle" class="detail-section">
          <h3>采纳与实施</h3>
          <el-form label-position="top"
            ><el-form-item label="采纳结果"
              ><el-select v-model="result.decision" @change="decisionChanged"
                ><el-option
                  v-for="(label, key) in decisions"
                  :key="key"
                  :label="label"
                  :value="key" /></el-select></el-form-item
            ><el-form-item label="采纳结果说明"
              ><el-input
                v-model="result.reason"
                type="textarea"
                :rows="3"
                maxlength="10000"
                show-word-limit /></el-form-item
            ><el-form-item v-if="result.decision === 'ACCEPTED'" label="实施进度"
              ><el-select v-model="result.progress"
                ><el-option
                  v-for="(label, key) in implementationProgresses"
                  :key="key"
                  :label="label"
                  :value="key" /></el-select></el-form-item
            ><el-form-item v-if="result.progress === 'COMPLETED' && result.decision === 'ACCEPTED'" label="完成说明"
              ><el-input
                v-model="result.completion"
                type="textarea"
                :rows="3"
                maxlength="10000"
                show-word-limit /></el-form-item
            ><div class="detail-actions">
              <el-button type="primary" :loading="saving" @click="saveOutcome">发布处理结果</el-button>
            </div></el-form
          >
        </section>
        <section v-if="detail.canHandle && tab !== 'audit'" class="detail-section">
          <h3>{{ tab === 'notes' ? '添加内部备注' : '回复填报者' }}</h3>
          <p v-if="tab !== 'notes'" class="demand-muted">
            正式回复发布后填报者可在「我的需求」查看；填报者追问会回到待我处理。
          </p>
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="4"
            maxlength="10000"
            show-word-limit
            :placeholder="tab === 'notes' ? '仅管理人员可见' : '发布后填报者即可查看'"
          />
          <div class="detail-actions">
            <el-button v-if="tab !== 'notes'" :loading="saving" @click="saveReply('DRAFT')">保存草稿</el-button
            ><el-button type="primary" :loading="saving" @click="saveReply(tab === 'notes' ? 'NOTE' : 'REPLY')">{{
              tab === 'notes' ? '保存内部备注' : '发布回复'
            }}</el-button>
          </div>
        </section>
        <section v-if="detail.canPublish || detail.canAssign" class="detail-section">
          <h3>内部公示</h3>
          <el-alert
            v-if="detail.publicationSkipped && !publicationPublished"
            title="该需求已标记为不公示；仍可在此重新发布公示。"
            type="info"
            :closable="false"
          />
          <el-alert
            v-if="detail.publication && detail.publication.archived"
            title="该公示已归档，员工端不再展示；重新发布后恢复。"
            type="info"
            :closable="false"
          />
          <p class="demand-muted">仅发布下列审核内容；不自动公开原始需求、附件和内部备注。</p>
          <el-form label-position="top"
            ><el-form-item label="公示标题"><el-input v-model="publication.title" maxlength="200" /></el-form-item
            ><el-form-item label="需求摘要"
              ><el-input v-model="publication.summary" type="textarea" :rows="3" maxlength="2000" /></el-form-item
            ><el-form-item label="正式说明与进展"
              ><el-input v-model="publication.content" type="textarea" :rows="5" maxlength="20000" /></el-form-item
            ><div class="detail-actions">
              <el-button
                v-if="publicationPublished"
                :loading="saving"
                @click="savePublication(false)"
                >撤回公示</el-button
              ><el-button
                v-else-if="!detail.publicationSkipped"
                :loading="saving"
                @click="skipAction"
                >不公示</el-button
              ><el-button type="primary" :loading="saving" @click="savePublication(true)">{{
                publicationPublished
                  ? '审核并更新公示'
                  : detail.publicationSkipped
                  ? '重新发布公示'
                  : '审核并发布公示'
              }}</el-button>
            </div></el-form
          >
        </section>
      </template>
    </div>
  </el-drawer>
</template>
<script>
import {
  requestDetail,
  lookup,
  handlers as listHandlers,
  assign,
  outcome,
  message,
  followUp,
  markRead,
  publish,
  skipPublication,
  downloadAttachment
} from '@/api/demand'
import { decisions, progresses, implementationProgresses } from '@/utils/demand'
export default {
  name: 'DemandDemandDetail',
  data() {
    return {
      visible: false,
      loading: false,
      saving: false,
      detail: null,
      error: '',
      tab: 'replies',
      mobile: window.innerWidth < 768,
      id: '',
      anonymousReceipt: null,
      handlers: [],
      handlerId: '',
      replyText: '',
      followupText: '',
      result: {},
      publication: {},
      decisions,
      progresses,
      implementationProgresses
    }
  },
  computed: {
    staff() {
      return this.detail && this.detail.canViewTable
    },
    publicationPublished() {
      return !!(this.detail && this.detail.publication && this.detail.publication.published)
    },
    replies() {
      return this.detail.messages.filter((m) => ['REPLY', 'EVENT', 'FOLLOWUP'].includes(m.kind))
    },
    notes() {
      return this.detail.messages.filter((m) => m.kind === 'NOTE')
    },
    audits() {
      return this.detail.messages.filter((m) => m.kind === 'AUDIT')
    },
    displayFields() {
      const data = this.detail.originalData || {}
      const fields = this.detail.formFields || []
      const used = new Set()
      const rows = []
      fields.forEach((field) => {
        const valueKey = String(field.value || '')
        if (!valueKey) return
        const baseKey = valueKey.endsWith('label') ? valueKey.slice(0, -5) : valueKey
        const dataKey = valueKey in data ? valueKey : baseKey in data ? baseKey : ''
        if (!dataKey) return
        used.add(valueKey)
        used.add(baseKey)
        rows.push({
          key: dataKey,
          label: field.label || dataKey,
          files: this.findFiles(data[dataKey]),
          text: this.display(data[dataKey]),
          department: this.isDepartmentField(field, dataKey)
        })
      })
      Object.keys(data).forEach((key) => {
        if (used.has(key)) return
        // 选择类字段原始值是内部选项 ID，已有 xxxlabel 显示值时不再单独成行。
        if ((key + 'label') in data) return
        rows.push({
          key,
          label: key,
          files: this.findFiles(data[key]),
          text: this.display(data[key]),
          department: key === 'demandDept' || key === 'demandDeptlabel'
        })
      })
      return rows.filter((row) => row.department).concat(rows.filter((row) => !row.department))
    },
  },
  mounted() {
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  },
  methods: {
    resize() {
      this.mobile = window.innerWidth < 768
    },
    isDepartmentField(field, dataKey) {
      const scheme = field.scheme && typeof field.scheme === 'object' ? field.scheme : {}
      const config = scheme.config && typeof scheme.config === 'object' ? scheme.config : {}
      return (
        config.demandDept === true ||
        config.demandDept === 'true' ||
        dataKey === 'demandDept' ||
        dataKey === 'demandDeptlabel'
      )
    },
    async open(id, receipt) {
      this.id = id
      this.anonymousReceipt = receipt || null
      this.detail = null
      this.tab = 'replies'
      this.followupText = ''
      this.visible = true
      await this.reload()
    },
    async reload() {
      this.loading = true
      this.error = ''
      try {
        const response = this.anonymousReceipt ? await lookup(this.anonymousReceipt) : await requestDetail(this.id)
        this.detail = response.data
        this.id = this.detail.id
        this.handlerId = this.detail.handlerId || ''
        this.result = {
          decision: this.detail.decision,
          progress: this.detail.progress,
          reason: this.detail.reason || '',
          completion: this.detail.completion || '',
          revision: this.detail.revision
        }
        this.publication = {
          title: this.detail.title,
          summary: '',
          content: '',
          version: 0,
          ...(this.detail.publication || {})
        }
        const draft = this.detail.messages.find((m) => m.kind === 'DRAFT')
        this.replyText = draft ? draft.content : ''
        if (this.detail.canAssign)
          this.handlers = (await listHandlers(this.detail.formKey)).data || []
        if (!this.anonymousReceipt) {
          await markRead({ type: 'DEMAND', id: this.detail.id, version: this.detail.publicVersion })
          this.$emit('read', this.detail.id)
          this.notify()
        }
      } catch (e) {
        this.error = e.msg || '无法读取需求，请刷新后重试。'
      } finally {
        this.loading = false
      }
    },
    async run(action, success) {
      this.saving = true
      try {
        await action()
        this.$message.success(success)
        await this.reload()
        this.$emit('updated')
        this.notify()
      } finally {
        this.saving = false
      }
    },
    saveAssign() {
      return this.run(
        () => assign(this.id, { handlerId: this.handlerId || null, revision: this.detail.revision }),
        '分派已保存'
      )
    },
    decisionChanged(value) {
      this.result.progress = value === 'ACCEPTED' ? 'PLANNED' : 'NONE'
    },
    saveOutcome() {
      if (this.result.decision !== 'PENDING' && !this.result.reason.trim())
        return this.$message.warning('请填写采纳结果说明')
      if (this.result.progress === 'COMPLETED' && !this.result.completion.trim())
        return this.$message.warning('请填写完成说明')
      return this.run(() => outcome(this.id, this.result), '处理结果已发布')
    },
    saveReply(kind) {
      if (!this.replyText.trim()) return this.$message.warning('请填写内容')
      return this.run(
        () => message(this.id, { kind, content: this.replyText }),
        kind === 'DRAFT' ? '草稿已保存' : kind === 'NOTE' ? '内部备注已保存' : '回复已发布'
      )
    },
    submitFollowUp() {
      if (!this.followupText.trim()) return this.$message.warning('请填写追问内容')
      const content = this.followupText
      return this.run(async () => {
        await followUp(this.id, { content })
        this.followupText = ''
      }, '追问已提交')
    },
    async savePublication(published) {
      if (published && !(this.detail.messages || []).some((m) => m.kind === 'REPLY'))
        return this.$message.warning('请先发布正式回复，再公示')
      if (
        published &&
        (!this.publication.title.trim() || !this.publication.summary.trim() || !this.publication.content.trim())
      )
        return this.$message.warning('请填写完整公示内容')
      await this.$confirm(published ? '确认已审核公示内容并向内部人员发布？' : '确认撤回这条公示？', '公示确认', {
        type: 'warning'
      })
      return this.run(
        () => publish(this.id, { ...this.publication, published }),
        published ? '公示已发布' : '公示已撤回'
      )
    },
    async skipAction() {
      await this.$confirm('确认将这条需求标记为不公示？之后可由单据管理员重新发布。', '不公示', {
        type: 'warning'
      })
      return this.run(
        () => skipPublication(this.id, { revision: this.detail.revision }),
        '已记录为不公示'
      )
    },
    notify() {
      window.dispatchEvent(new Event('demand-updated'))
    },
    date(v) {
      return v ? String(v).replace('T', ' ').substring(0, 16) : ''
    },
    display(value) {
      if (value === null || value === undefined || value === '') return '—'
      if (Array.isArray(value)) return value.map(this.display).join('、')
      return typeof value === 'object' ? Object.values(value).map(this.display).join(' / ') : String(value)
    },
    findFiles(value) {
      if (Array.isArray(value)) return value.flatMap((v) => this.findFiles(v))
      if (value && typeof value === 'object')
        return value.url ? [value] : Object.values(value).flatMap((v) => this.findFiles(v))
      return []
    },
    async download(file) {
      const response = await downloadAttachment(this.id, {
        url: file.url,
        queryCode: this.anonymousReceipt ? this.anonymousReceipt.queryCode : null
      })
      const blob = response instanceof Blob ? response : response.data
      if (!(blob instanceof Blob)) return this.$message.error('附件下载失败')
      if (blob.type.includes('json')) {
        this.$message.error('附件无法下载或访问权限已变化')
        return
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name || '需求附件'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}
</script>
<style scoped>
.detail-title {
  font-size: 21px;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
.original-fields {
  margin: 24px 0;
}
.original-field {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}
.field-label {
  color: #909399;
}
.field-content {
  min-width: 0;
  overflow-wrap: anywhere;
}
.message-author {
  font-weight: 500;
}
.detail-section {
  padding-top: 24px;
  margin-top: 24px;
  border-top: 1px solid #ebeef5;
}
.detail-section h3 {
  font-size: 17px;
  margin: 0 0 18px;
}
.assign-controls {
  display: flex;
  flex-wrap: wrap;
}
.assign-controls .el-select {
  width: 100%;
}
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.detail-actions .el-button + .el-button {
  margin-left: 0;
}
.followup-notice {
  margin-bottom: 16px;
}
.followup-waiting {
  margin-top: 12px;
}
.internal-message {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
}
.internal-message small {
  color: #909399;
}
.outcome-summary {
  background: #f7f8fa;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 24px;
}
.outcome-summary p {
  line-height: 1.7;
}
.detail-section > .demand-muted {
  line-height: 1.7;
}
@media (max-width: 767px) {
  .original-field {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .assign-controls .el-select {
    flex: 1;
    min-width: 0;
  }
}
</style>
