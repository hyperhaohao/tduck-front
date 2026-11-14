<template>
  <section class="demand-page" v-loading="loading">
    <h1>{{ pending ? '待我处理' : '我的需求' }}</h1>
    <p class="demand-subtitle">{{ subtitle }}</p>
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
        /><el-select v-model="query.decision" clearable placeholder="采纳结果"
          ><el-option v-for="(label, key) in decisions" :key="key" :label="label" :value="key" /></el-select
        ><el-select v-model="query.progress" clearable placeholder="实施进度"
          ><el-option
            v-for="(label, key) in implementationProgresses"
            :key="key"
            :label="label"
            :value="key" /></el-select
        ><el-button type="primary" icon="el-icon-search" @click="search">查询</el-button
        ><el-button @click="reset">重置</el-button>
      </div>
      <el-table class="demand-list-desktop" :data="rows" empty-text="暂无需求" @row-click="open">
        <el-table-column label="需求" min-width="230"
          ><template slot-scope="s"
            ><div class="request-title">
              {{ s.row.title }} <el-tag v-if="!pending && s.row.unread" type="danger" size="mini">未读</el-tag>
            </div>
            <small class="demand-muted">{{ s.row.requestNo }} · {{ plain(s.row.formName) }}</small></template
          ></el-table-column
        >
        <el-table-column v-if="pending" prop="submitterName" label="填报者" width="100" /><el-table-column
          prop="handlerName"
          label="经办人"
          width="100"
        />
        <el-table-column label="采纳结果" width="100"
          ><template slot-scope="s"
            ><el-tag :type="tag(s.row.decision)" size="small">{{ decisions[s.row.decision] }}</el-tag></template
          ></el-table-column
        ><el-table-column label="实施进度" width="100"
          ><template slot-scope="s">{{ progresses[s.row.progress] }}</template></el-table-column
        ><el-table-column label="提交时间" width="150"
          ><template slot-scope="s">{{ date(s.row.createTime) }}</template></el-table-column
        ><el-table-column label="操作" width="75"
          ><template slot-scope="s"
            ><el-button type="text" @click.stop="open(s.row)">查看</el-button></template
          ></el-table-column
        >
      </el-table>
      <div class="demand-list-mobile">
        <article v-for="row in rows" :key="row.id" class="demand-card" @click="open(row)">
          <h3>{{ row.title }} <el-tag v-if="!pending && row.unread" type="danger" size="mini">未读</el-tag></h3>
          <small class="demand-muted">{{ row.requestNo }}</small>
          <p>{{ plain(row.formName) }} · {{ row.handlerName || '待分派' }}</p>
          <div class="demand-card-footer">
            <div class="demand-tags">
              <el-tag :type="tag(row.decision)" size="small">{{ decisions[row.decision] }}</el-tag
              ><el-tag v-if="row.progress !== 'NONE'" type="info" size="small">{{ progresses[row.progress] }}</el-tag>
            </div>
            <el-button type="text" @click.stop="open(row)">查看</el-button>
          </div>
        </article>
        <el-empty v-if="!rows.length && !loading" description="暂无需求" />
      </div>
      <el-pagination
        :current-page.sync="query.page"
        :page-size="query.size"
        :total="total"
        layout="total, prev, pager, next"
        :pager-count="5"
        @current-change="load"
      />
    </template>
    <demand-detail ref="detail" @updated="afterUpdate" @read="readRow" />
  </section>
</template>
<script>
import { listRequests, requestSummary } from '@/api/demand'
import { decisions, progresses, implementationProgresses } from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
import FormOverview from './components/FormOverview'
export default {
  name: 'DemandRequests',
  components: { DemandDetail, FormOverview },
  data() {
    return {
      rows: [],
      total: 0,
      loading: false,
      error: '',
      decisions,
      progresses,
      implementationProgresses,
      scope: this.$route.path.endsWith('/pending') ? 'pending' : 'mine',
      formSummaries: [],
      formKeyword: '',
      formsLoading: false,
      selectedFormKey: '',
      selectedFormName: '',
      query: { keyword: '', decision: '', progress: '', formKey: '', handlerId: '', page: 1, size: 20 }
    }
  },
  computed: {
    pending() {
      return this.$route.path.endsWith('/pending')
    },
    subtitle() {
      if (this.selectedFormKey) return '该收集单下的需求明细，可继续搜索或筛选。'
      return this.pending
        ? '按收集单分类查看分派给本人的待办需求。'
        : '按收集单分类查看本人需求的正式回复、采纳结果与实施进度。'
    },
    emptyText() {
      return this.scope === 'pending' ? '暂无待办需求' : '暂无需求'
    },
    filteredForms() {
      const keyword = this.formKeyword.trim()
      if (!keyword) return this.formSummaries
      return this.formSummaries.filter((form) => this.plain(form.formName).includes(keyword))
    }
  },
  async created() {
    await this.loadView()
    if (this.$route.query.id) this.$refs.detail.open(this.$route.query.id)
  },
  methods: {
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
        const r = await listRequests({ ...this.query, scope: this.scope })
        this.rows = r.data.rows
        this.total = r.data.total
      } catch (e) {
        this.error = e.msg || '需求加载失败，请重试。'
      } finally {
        this.loading = false
      }
    },
    selectForm(item) {
      this.selectedFormKey = item.formKey
      this.selectedFormName = this.plain(item.formName)
      this.query.formKey = item.formKey
      this.query.page = 1
      this.load()
    },
    backToForms() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.query.formKey = ''
      this.query.page = 1
      this.loadForms()
    },
    scopeChanged() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.query.formKey = ''
      this.query.page = 1
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
      Object.assign(this.query, { keyword: '', decision: '', progress: '', handlerId: '', page: 1 })
      this.load()
    },
    readRow(id) {
      const row = this.rows.find((r) => r.id === id)
      if (row) row.unread = false
    },
    open(row) {
      this.$refs.detail.open(row.id)
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
</style>
