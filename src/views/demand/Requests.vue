<template>
  <section class="demand-page" v-loading="loading">
    <div class="demand-title-row">
      <div>
        <h1>{{ pending ? '待我处理' : approval ? '待我审批' : '我的需求' }}</h1>
        <p class="demand-subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <el-radio-group v-if="pending" v-model="scope" size="small" @change="scopeChanged"
      ><el-radio-button label="pending">待我处理</el-radio-button
      ><el-radio-button label="table">获授权总表</el-radio-button></el-radio-group
    >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="!selectedFormKey">
      <div class="demand-toolbar">
        <el-input
          v-model="formKeyword"
          placeholder="搜索收集单"
          clearable
          prefix-icon="el-icon-search"
        />
      </div>
      <form-overview
        :items="filteredForms"
        :loading="formsLoading"
        :empty-text="emptyText"
        @select="selectForm"
      />
    </template>
    <template v-else>
      <el-button class="demand-back" type="text" icon="el-icon-back" @click="backToForms"
        >全部收集单</el-button
      >
      <h2 class="form-heading">{{ selectedFormName }}</h2>
      <div class="demand-toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="搜索标题、编号或收集单"
          clearable
          @keyup.enter.native="search"
        /><el-select v-if="!selectedFormCollectOnly && !approval" v-model="query.decision" clearable placeholder="采纳结果"
          ><el-option v-for="(label, key) in decisions" :key="key" :label="label" :value="key" /></el-select
        ><el-select v-if="!selectedFormCollectOnly && !approval" v-model="query.progress" clearable placeholder="实施进度"
          ><el-option
            v-for="(label, key) in implementationProgresses"
            :key="key"
            :label="label"
            :value="key" /></el-select
        ><el-date-picker
          v-model="submitRange"
          type="daterange"
          value-format="yyyy-MM-dd"
          range-separator="至"
          start-placeholder="提报开始"
          end-placeholder="提报结束"
          unlink-panels
        /><el-button type="primary" icon="el-icon-search" @click="search">查询</el-button
        ><el-button @click="reset">重置</el-button
        ><el-button v-if="!approval" icon="el-icon-download" :loading="exporting" @click="exportExcel">导出 Excel</el-button>
      </div>
      <div v-if="batchEnabled && selectedRows.length" class="demand-batch-bar">
        <span class="demand-muted">已选 {{ selectedRows.length }} 条</span>
        <el-button v-if="batchCanManage" size="small" @click="openBatchAssign">批量分派</el-button>
        <el-button v-if="batchCanManage" size="small" @click="batchPublish">批量公示</el-button>
        <el-button v-if="batchCanManage" size="small" @click="batchSkip">批量跳过公示</el-button>
        <el-button type="primary" size="small" @click="openBatchOutcome">批量更新结果</el-button>
        <el-button type="text" size="small" @click="clearSelection">取消选择</el-button>
      </div>
      <el-table
        ref="table"
        class="demand-list-desktop demand-table-compact"
        :data="rows"
        empty-text="暂无需求"
        @row-click="rowClick"
        @selection-change="selectionChanged"
      >
        <el-table-column v-if="batchEnabled" type="selection" width="34" />
        <el-table-column label="需求" :width="roomy ? 360 : null" min-width="120"
          ><template slot-scope="s"
            ><div class="request-title" :title="s.row.title">
              {{ s.row.title }} <el-tag v-if="s.row.unread && (!pending || s.row.collectOnly)" type="danger" size="mini">未读</el-tag>
              <template v-if="s.row.collectOnly">
                <el-tag type="info" size="mini">只收集</el-tag>
              </template>
              <template v-else>
                <el-tag v-if="s.row.approvalStatus === 'PENDING'" type="warning" size="mini">待审批</el-tag>
                <el-tag v-else-if="s.row.approvalStatus === 'REJECTED'" type="danger" size="mini">已驳回</el-tag>
                <el-tag v-else-if="s.row.publicationPublished" type="success" size="mini">已公示</el-tag>
                <el-tag v-else-if="s.row.publicationArchived" type="info" size="mini">已归档</el-tag>
                <el-tag v-else-if="s.row.publicationSkipped" type="info" size="mini">不公示</el-tag>
                <el-tag v-else-if="pending && s.row.decision !== 'REJECTED' && s.row.progress !== 'COMPLETED'" type="warning" size="mini">待公示</el-tag>
                <el-tag v-if="s.row.followupPending" type="warning" size="mini">追问</el-tag>
              </template>
            </div>
            <small class="demand-muted request-meta" :title="meta(s.row)">{{ meta(s.row) }}</small></template
          ></el-table-column
        >
        <el-table-column v-if="pending || approval" prop="submitterName" label="填报者" width="72" class-name="nowrap-cell" /><el-table-column
          v-if="approval"
          label="当前级"
          width="150"
          ><template slot-scope="s"
            ><div class="request-title">{{ s.row.approvalDeptName || '部门主管' }}</div>
            <small class="demand-muted"
              >第{{ s.row.approvalStep || 1 }}级<template v-if="approverNames(s.row)">
                · {{ approverNames(s.row) }}</template
              ></small
            ></template
          ></el-table-column
        ><el-table-column
          v-if="!approval"
          prop="handlerName"
          label="经办人"
          width="82"
          class-name="nowrap-cell"
        />
        <el-table-column v-if="!approval" label="采纳结果" width="76"
          ><template slot-scope="s"
            ><el-tag v-if="s.row.collectOnly" type="info" size="small">只收集</el-tag
            ><el-tag v-else :type="tag(s.row.decision)" size="small">{{ decisions[s.row.decision] }}</el-tag></template
          ></el-table-column
        ><el-table-column v-if="!approval" label="实施进度" width="72"
          ><template slot-scope="s">{{ s.row.collectOnly ? '—' : progresses[s.row.progress] }}</template></el-table-column
        ><el-table-column label="提报时间" width="116"
          ><template slot-scope="s">{{ date(s.row.createTime) }}</template></el-table-column
        ><el-table-column v-if="!approval" label="回复时间" width="116"
          ><template slot-scope="s">{{ date(s.row.replyTime) }}</template></el-table-column
        ><el-table-column v-if="wide" label="操作" width="64"
          ><template slot-scope="s"
            ><el-button type="text" @click.stop="open(s.row)">查看</el-button></template
          ></el-table-column
        ><el-table-column v-if="roomy" />
      </el-table>
      <div class="demand-list-mobile">
        <article
          v-for="row in rows"
          :key="row.id"
          class="demand-card demand-card-compact demand-card-clickable"
          @click="open(row)"
        >
          <div class="demand-card-body">
            <div class="demand-card-title-row">
              <h3 class="demand-card-title">{{ row.title }}</h3>
              <el-tag v-if="row.unread && (!pending || row.collectOnly)" type="danger" size="mini">未读</el-tag>
            </div>
            <p class="demand-card-kicker">{{ row.requestNo }}</p>
            <p class="demand-card-line">{{ plain(row.formName) }} · {{ approval ? approvalLine(row) : row.handlerName || '待分派' }}</p>
            <p class="demand-card-time">
              提报 {{ date(row.createTime) }}<span v-if="row.replyTime"> · 回复 {{ date(row.replyTime) }}</span>
            </p>
            <div class="demand-tags demand-card-tags">
              <template v-if="row.collectOnly">
                <el-tag type="info" size="small">只收集</el-tag>
              </template>
              <template v-else>
                <el-tag v-if="row.approvalStatus === 'PENDING'" type="warning" size="small">待审批</el-tag>
                <el-tag v-else-if="row.approvalStatus === 'REJECTED'" type="danger" size="small">已驳回</el-tag>
                <template v-if="!approval">
                  <el-tag :type="tag(row.decision)" size="small">{{ decisions[row.decision] }}</el-tag
                  ><el-tag v-if="row.progress !== 'NONE'" type="info" size="small">{{ progresses[row.progress] }}</el-tag
                  ><el-tag v-if="row.publicationPublished" type="success" size="small">已公示</el-tag
                  ><el-tag v-else-if="row.publicationArchived" type="info" size="small">已归档</el-tag
                  ><el-tag v-else-if="row.publicationSkipped" type="info" size="small">不公示</el-tag>
                </template>
                <el-tag v-if="row.followupPending" type="warning" size="small">追问</el-tag>
              </template>
            </div>
          </div>
          <div class="demand-card-actions">
            <div class="demand-card-actions-main">
              <el-button size="mini" class="demand-card-action is-primary" @click.stop="open(row)"
                >查看</el-button
              >
            </div>
          </div>
        </article>
        <el-empty v-if="!rows.length && !loading" :description="emptyText" />
      </div>
      <el-pagination
        :current-page.sync="query.page"
        :page-size="query.size"
        :total="total"
        layout="total, prev, pager, next"
        :pager-count="5"
        @current-change="load"
      />
      <el-dialog
        title="批量分派"
        :visible.sync="batchAssignVisible"
        :width="dialogWidth"
        :close-on-click-modal="false"
      >
        <p class="demand-muted">已选 {{ selectedRows.length }} 条需求，将统一分派给：</p>
        <el-select v-model="batchHandlerId" filterable clearable placeholder="选择已授权经办人" style="width: 100%">
          <el-option v-for="member in batchHandlers" :key="member.userId" :label="member.name" :value="member.userId" />
        </el-select>
        <span slot="footer"
          ><el-button @click="batchAssignVisible = false">取消</el-button
          ><el-button type="primary" :loading="batchBusy" @click="saveBatchAssign">确认分派</el-button></span
        >
      </el-dialog>
      <el-dialog
        title="批量更新结果"
        :visible.sync="batchOutcomeVisible"
        :width="dialogWidth"
        :close-on-click-modal="false"
      >
        <p class="demand-muted">将同一采纳结果与实施进度应用到已选 {{ selectedRows.length }} 条需求。</p>
        <el-form label-position="top"
          ><el-form-item label="采纳结果" required
            ><el-select v-model="batchOutcome.decision" style="width: 100%" @change="batchDecisionChanged"
              ><el-option v-for="(label, key) in outcomeDecisions" :key="key" :label="label" :value="key" /></el-select></el-form-item
          ><el-form-item label="采纳结果说明" required
            ><el-input v-model="batchOutcome.reason" type="textarea" :rows="3" maxlength="10000" /></el-form-item
          ><el-form-item v-if="batchOutcome.decision === 'ACCEPTED'" label="实施进度" required
            ><el-select v-model="batchOutcome.progress" style="width: 100%"
              ><el-option
                v-for="(label, key) in implementationProgresses"
                :key="key"
                :label="label"
                :value="key" /></el-select></el-form-item
          ><el-form-item
            v-if="batchOutcome.decision === 'ACCEPTED' && batchOutcome.progress === 'COMPLETED'"
            label="完成说明"
            required
            ><el-input v-model="batchOutcome.completion" type="textarea" :rows="3" maxlength="10000" /></el-form-item
        ></el-form>
        <span slot="footer"
          ><el-button @click="batchOutcomeVisible = false">取消</el-button
          ><el-button type="primary" :loading="batchBusy" @click="saveBatchOutcome">确认更新</el-button></span
        >
      </el-dialog>
      <el-dialog title="批量处理结果" :visible.sync="batchResultVisible" :width="dialogWidth">
        <p>
          成功 {{ batchResult.success }} 条<span v-if="batchResult.skipped">，跳过 {{ batchResult.skipped }} 条</span
          ><span v-if="batchResult.failed">，失败 {{ batchResult.failed }} 条</span>
        </p>
        <ul v-if="batchResult.items.length" class="batch-failures">
          <li v-for="(item, index) in batchResult.items" :key="index">
            <strong>{{ item.title }}</strong
            >：{{ item.msg }}
          </li>
        </ul>
        <span slot="footer"
          ><el-button type="primary" @click="batchResultVisible = false">知道了</el-button></span
        >
      </el-dialog>
    </template>
    <demand-detail ref="detail" @updated="afterUpdate" @read="readRow" />
  </section>
</template>
<script>
import {
  listRequests,
  requestSummary,
  exportRequests,
  assign,
  outcome,
  handlers as listHandlers,
  autoPublish,
  skipPublication
} from '@/api/demand'
import {
  decisions,
  progresses,
  implementationProgresses,
  outcomeDecisions,
  demandState
} from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
import FormOverview from './components/FormOverview'
import exportMixin from './exportMixin'
export default {
  name: 'DemandRequests',
  components: { DemandDetail, FormOverview },
  mixins: [exportMixin],
  data() {
    return {
      rows: [],
      total: 0,
      loading: false,
      error: '',
      decisions,
      progresses,
      implementationProgresses,
      outcomeDecisions,
      scope: this.$route.path.endsWith('/pending')
        ? 'pending'
        : this.$route.path.endsWith('/approvals')
          ? 'approval'
          : 'mine',
      formSummaries: [],
      formKeyword: '',
      formsLoading: false,
      selectedFormKey: '',
      selectedFormName: '',
      selectedFormManage: false,
      selectedFormCollectOnly: false,
      submitRange: [],
      query: { keyword: '', decision: '', progress: '', formKey: '', handlerId: '', page: 1, size: 20 },
      mobile: window.innerWidth < 768,
      wide: window.innerWidth >= 1200,
      roomy: window.innerWidth >= 1440,
      selectedRows: [],
      batchBusy: false,
      batchAssignVisible: false,
      batchHandlerId: '',
      batchHandlers: [],
      batchOutcomeVisible: false,
      batchOutcome: { decision: 'ACCEPTED', progress: 'PLANNED', reason: '', completion: '' },
      batchResultVisible: false,
      batchResult: { label: '', success: 0, skipped: 0, failed: 0, items: [] }
    }
  },
  computed: {
    pending() {
      return this.$route.path.endsWith('/pending')
    },
    approval() {
      return this.$route.path.endsWith('/approvals')
    },
    subtitle() {
      if (this.selectedFormKey) return '该收集单下的需求明细，可继续搜索或筛选。'
      if (this.approval) return '同一级任一主管通过即可；逐级审批全部通过后进入单据处理。'
      return this.pending
        ? '按收集单分类查看分派给本人的待办需求。'
        : '按收集单分类查看本人需求的正式回复、采纳结果与实施进度。'
    },
    emptyText() {
      if (this.approval) return '暂无待审批需求'
      return this.scope === 'pending' ? '暂无待办需求' : '暂无需求'
    },
    filteredForms() {
      const keyword = this.formKeyword.trim()
      if (!keyword) return this.formSummaries
      return this.formSummaries.filter((form) => this.plain(form.formName).includes(keyword))
    },
    batchCanManage() {
      return this.selectedFormManage || demandState.global
    },
    batchEnabled() {
      return (
        this.pending &&
        this.scope === 'pending' &&
        !!this.selectedFormKey &&
        !this.selectedFormCollectOnly &&
        (demandState.global || demandState.manage || demandState.handler)
      )
    },
    dialogWidth() {
      return this.mobile ? '94%' : '520px'
    }
  },
  async created() {
    await this.loadView()
    if (this.$route.query.id) this.$refs.detail.open(this.$route.query.id)
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
      this.wide = window.innerWidth >= 1200
      this.roomy = window.innerWidth >= 1440
    },
    async loadView() {
      if (this.selectedFormKey) await this.load()
      else await this.loadForms()
    },
    async loadForms() {
      this.formsLoading = true
      this.error = ''
      try {
        this.formSummaries = (await requestSummary({ scope: this.scope })).data || []
      } catch (e) {
        this.error = e.msg || '收集单加载失败，请重试。'
      } finally {
        this.formsLoading = false
      }
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        const r = await listRequests({
          ...this.query,
          submitStart: this.submitRange[0] || '',
          submitEnd: this.submitRange[1] || '',
          scope: this.scope
        })
        this.rows = r.data.rows
        this.total = r.data.total
        this.selectedRows = []
        this.$nextTick(() => {
          if (this.$refs.table) this.$refs.table.clearSelection()
        })
      } catch (e) {
        this.error = e.msg || '需求加载失败，请重试。'
      } finally {
        this.loading = false
      }
    },
    selectForm(item) {
      this.selectedFormKey = item.formKey
      this.selectedFormName = this.plain(item.formName)
      this.selectedFormManage = !!item.canManage || demandState.global
      this.selectedFormCollectOnly = !!item.collectOnly
      this.query.formKey = item.formKey
      this.query.page = 1
      this.load()
    },
    backToForms() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.selectedFormManage = false
      this.selectedFormCollectOnly = false
      this.query.formKey = ''
      this.query.page = 1
      this.resetBatch()
      this.loadForms()
    },
    scopeChanged() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.selectedFormManage = false
      this.selectedFormCollectOnly = false
      this.query.formKey = ''
      this.query.page = 1
      this.resetBatch()
      this.loadForms()
    },
    afterUpdate() {
      if (this.selectedFormKey) this.load()
      else this.loadForms()
    },
    search() {
      this.query.page = 1
      this.load()
    },
    reset() {
      this.submitRange = []
      Object.assign(this.query, { keyword: '', decision: '', progress: '', handlerId: '', page: 1 })
      this.load()
    },
    readRow(id) {
      const row = this.rows.find((r) => r.id === id)
      if (row) row.unread = false
      if (this.selectedFormCollectOnly) {
        this.load()
        this.loadForms()
      }
    },
    open(row) {
      this.$refs.detail.open(row.id)
    },
    rowClick(row, column) {
      if (column && column.type === 'selection') return
      this.open(row)
    },
    selectionChanged(rows) {
      this.selectedRows = rows
    },
    clearSelection() {
      if (this.$refs.table) this.$refs.table.clearSelection()
      this.selectedRows = []
    },
    resetBatch() {
      this.selectedRows = []
      this.batchHandlerId = ''
      this.batchHandlers = []
      this.batchAssignVisible = false
      this.batchOutcomeVisible = false
      this.batchResultVisible = false
      this.$nextTick(() => {
        if (this.$refs.table) this.$refs.table.clearSelection()
      })
    },
    meta(row) {
      return `${row.requestNo || ''} · ${this.plain(row.formName)}`
    },
    approvalLine(row) {
      const step = `第${row.approvalStep || 1}级`
      return row.approvalDeptName
        ? `待审批 · ${step} · ${row.approvalDeptName}`
        : `待审批 · ${step}`
    },
    approverNames(row) {
      return (row.approvalApprovers || []).join('、')
    },
    exportExcel() {
      const prefix = this.scope === 'table' ? '需求总表' : this.pending ? '待我处理' : '我的需求'
      return this.saveExport(
        () =>
          exportRequests({
            scope: this.scope,
            keyword: this.query.keyword,
            decision: this.query.decision,
            progress: this.query.progress,
            formKey: this.query.formKey,
            handlerId: this.query.handlerId,
            submitStart: this.submitRange[0] || '',
            submitEnd: this.submitRange[1] || ''
          }),
        prefix
      )
    },
    async openBatchAssign() {
      if (!this.selectedRows.length) return this.$message.warning('请先选择需求')
      try {
        this.batchHandlers = (await listHandlers(this.selectedFormKey)).data || []
      } catch (e) {
        return
      }
      this.batchHandlerId = ''
      this.batchAssignVisible = true
    },
    async saveBatchAssign() {
      if (!this.batchHandlerId) return this.$message.warning('请选择经办人')
      const rows = [...this.selectedRows]
      this.batchAssignVisible = false
      await this.runBatch('批量分派', rows, (row) =>
        assign(row.id, { handlerId: this.batchHandlerId, revision: row.revision }, { silent: true })
      )
      this.clearSelection()
    },
    openBatchOutcome() {
      if (!this.selectedRows.length) return this.$message.warning('请先选择需求')
      this.batchOutcome = { decision: 'ACCEPTED', progress: 'PLANNED', reason: '', completion: '' }
      this.batchOutcomeVisible = true
    },
    batchDecisionChanged(value) {
      this.batchOutcome.progress = value === 'ACCEPTED' ? 'PLANNED' : 'NONE'
      if (value !== 'ACCEPTED') this.batchOutcome.completion = ''
    },
    async saveBatchOutcome() {
      const form = this.batchOutcome
      if (!form.decision) return this.$message.warning('请选择采纳结果')
      if (!form.reason.trim()) return this.$message.warning('请填写采纳结果说明')
      if (form.decision === 'ACCEPTED' && !form.progress) return this.$message.warning('请选择实施进度')
      if (form.decision === 'ACCEPTED' && form.progress === 'COMPLETED' && !form.completion.trim())
        return this.$message.warning('请填写完成说明')
      const rows = [...this.selectedRows]
      this.batchOutcomeVisible = false
      await this.runBatch('批量更新结果', rows, (row) =>
        outcome(
          row.id,
          {
            decision: form.decision,
            progress: form.decision === 'ACCEPTED' ? form.progress : 'NONE',
            reason: form.reason,
            completion: form.decision === 'ACCEPTED' ? form.completion : '',
            revision: row.revision
          },
          { silent: true }
        )
      )
      this.clearSelection()
    },
    async batchPublish() {
      const selected = [...this.selectedRows]
      const candidates = selected.filter(
        (row) => !row.publicationPublished && !row.publicationArchived
      )
      const rows = candidates.filter((row) => row.decision && row.decision !== 'PENDING')
      const preSkipped = selected.length - rows.length
      if (!candidates.length) return this.$message.info('所选需求均已公示或归档')
      if (!rows.length) return this.$message.warning('所选需求均未明确采纳结果，无法公示')
      try {
        await this.$confirm(
          `将自动使用需求标题、采纳说明和最近正式回复生成并发布 ${rows.length} 条公示；已公示、已归档或未明确采纳结果的 ${preSkipped} 条将跳过。是否继续？`,
          '批量公示',
          { type: 'warning' }
        )
      } catch (e) {
        return
      }
      await this.runBatch(
        '批量公示',
        rows,
        (row) => autoPublish(row.id, { revision: row.revision }, { silent: true }),
        preSkipped
      )
      this.clearSelection()
    },
    async batchSkip() {
      const selected = [...this.selectedRows]
      const rows = selected.filter((row) => !row.publicationPublished && !row.publicationSkipped)
      const preSkipped = selected.length - rows.length
      if (!rows.length) return this.$message.info('所选需求均已公示或已跳过')
      try {
        await this.$confirm(
          `将 ${rows.length} 条需求标记为不公示并移出待办，已公示或已跳过的 ${preSkipped} 条将跳过。是否继续？`,
          '批量跳过公示',
          { type: 'warning' }
        )
      } catch (e) {
        return
      }
      await this.runBatch(
        '批量跳过公示',
        rows,
        (row) => skipPublication(row.id, { revision: row.revision }, { silent: true }),
        preSkipped
      )
      this.clearSelection()
    },
    async runBatch(label, rows, action, preSkipped = 0) {
      this.batchBusy = true
      let success = 0
      let skipped = preSkipped
      let failed = 0
      let expired = false
      const items = []
      try {
        for (const row of rows) {
          try {
            const result = await action(row)
            const data = result && result.data
            if (data && (data.unchanged === true || data.changed === false)) skipped++
            else success++
          } catch (e) {
            if (e && e.code === 401) {
              expired = true
              break
            }
            failed++
            items.push({ title: row.title, msg: (e && e.msg) || '操作失败' })
          }
        }
      } finally {
        this.batchBusy = false
      }
      await this.load()
      window.dispatchEvent(new Event('demand-updated'))
      if (expired) return this.$message.error('登录已过期，请重新登录后继续')
      if (failed) {
        this.batchResult = { label, success, skipped, failed, items }
        this.batchResultVisible = true
      } else {
        this.$message.success(
          `${label}完成：成功 ${success} 条${skipped ? `，跳过 ${skipped} 条` : ''}`
        )
      }
    },
    plain(v) {
      return new DOMParser().parseFromString(v || '', 'text/html').body.textContent || ''
    },
    date(v) {
      return v ? String(v).replace('T', ' ').substring(0, 16) : ''
    },
    tag(v) {
      return v === 'ACCEPTED' ? 'success' : v === 'REJECTED' ? 'info' : 'warning'
    }
  }
}
</script>
<style scoped>
.request-title {
  font-weight: 500;
  margin-bottom: 6px;
  overflow-wrap: anywhere;
}
.demand-back {
  padding: 0;
  margin-top: 16px;
}
.form-heading {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.demand-batch-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
  margin: 0 0 12px;
  background: #f7f8fa;
  border: 1px solid #ebeef5;
  border-radius: 10px;
}
.demand-batch-bar .el-button {
  margin: 0;
}
.batch-failures {
  padding-left: 20px;
  line-height: 1.9;
  max-height: 220px;
  overflow: auto;
}
@media (max-width: 767px) {
  .demand-batch-bar {
    display: none;
  }
}
</style>
