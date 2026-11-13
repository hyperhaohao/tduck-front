<template>
  <section class="demand-page" v-loading="loading">
    <h1>{{ pending ? '待我处理' : '我的需求' }}</h1>
    <p class="demand-subtitle">
      {{
        pending ? '在同一总表中协作，经办人填写采纳结果并跟踪到完成。' : '查看本人需求的正式回复、采纳结果与实施进度。'
      }}
    </p>
    <el-radio-group v-if="pending" v-model="scope" size="small" @change="search"
      ><el-radio-button label="pending">待我处理</el-radio-button
      ><el-radio-button label="table">获授权总表</el-radio-button></el-radio-group
    >
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
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
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
    <demand-detail ref="detail" @updated="load" @read="readRow" />
  </section>
</template>
<script>
import { listRequests } from '@/api/demand'
import { decisions, progresses, implementationProgresses } from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
export default {
  name: 'DemandRequests',
  components: { DemandDetail },
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
      query: { keyword: '', decision: '', progress: '', formKey: '', handlerId: '', page: 1, size: 20 }
    }
  },
  computed: {
    pending() {
      return this.$route.path.endsWith('/pending')
    }
  },
  async created() {
    await this.load()
    if (this.$route.query.id) this.$refs.detail.open(this.$route.query.id)
  },
  methods: {
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
    search() {
      this.query.page = 1
      this.load()
    },
    reset() {
      Object.assign(this.query, { keyword: '', decision: '', progress: '', formKey: '', handlerId: '', page: 1 })
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
</style>
