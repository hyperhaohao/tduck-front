<template>
  <section class="demand-page" v-loading="loading">
    <h1>需求公示</h1>
    <p class="demand-subtitle">
      {{
        selectedFormKey
          ? '该收集单下已审核发布的需求摘要、采纳结果与正式进展。'
          : '按收集单分类查看已审核发布的需求摘要、采纳结果与正式进展。'
      }}
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="!selectedFormKey">
      <div class="demand-toolbar">
        <el-input v-model="formKeyword" placeholder="搜索收集单" clearable prefix-icon="el-icon-search" />
      </div>
      <form-overview
        :items="filteredForms"
        :loading="loading"
        action-text="查看公示"
        total-label="公示"
        empty-text="暂无已发布公示"
        @select="selectForm"
      />
    </template>
    <template v-else>
      <el-button class="demand-back" type="text" icon="el-icon-back" @click="backToForms"
        >全部收集单</el-button
      >
      <h2 class="form-heading">{{ selectedFormName }}</h2>
      <div class="demand-toolbar">
        <el-input v-model="keyword" placeholder="搜索公示标题或摘要" clearable prefix-icon="el-icon-search" /><el-date-picker
          v-model="submitRange"
          type="daterange"
          value-format="yyyy-MM-dd"
          range-separator="至"
          start-placeholder="提报开始"
          end-placeholder="提报结束"
          unlink-panels
        /><el-button icon="el-icon-download" :loading="exporting" @click="exportExcel">导出 Excel</el-button>
      </div>
      <el-table class="demand-list-desktop demand-table-compact" :data="filtered" empty-text="暂无已发布公示" @row-click="open">
        <el-table-column label="需求" min-width="140"
          ><template slot-scope="s"
            ><div class="request-title" :title="s.row.title">
              {{ s.row.title }} <el-tag v-if="s.row.unread" type="danger" size="mini">未读</el-tag>
            </div>
            <small class="demand-muted request-meta" :title="meta(s.row)">{{ meta(s.row) }}</small></template
          ></el-table-column
        ><el-table-column prop="submitterName" label="填报者" width="72" class-name="nowrap-cell" /><el-table-column
          prop="handlerName"
          label="经办人"
          width="82"
          class-name="nowrap-cell"
        /><el-table-column label="采纳结果" width="76"
          ><template slot-scope="s"
            ><el-tag size="small">{{ decisions[s.row.decision] }}</el-tag></template
          ></el-table-column
        ><el-table-column label="实施进度" width="72"
          ><template slot-scope="s">{{ progresses[s.row.progress] }}</template></el-table-column
        ><el-table-column label="提报时间" width="116"
          ><template slot-scope="s">{{ date(s.row.createTime) }}</template></el-table-column
        ><el-table-column label="回复时间" width="116"
          ><template slot-scope="s">{{ date(s.row.updateTime) }}</template></el-table-column
        ><el-table-column v-if="wide" label="操作" width="64"
          ><template slot-scope="s"
            ><el-button type="text" @click.stop="open(s.row)">查看公示</el-button></template
          ></el-table-column
        >
      </el-table>
      <div class="demand-list-mobile">
        <article v-for="row in filtered" :key="row.id" class="demand-card" @click="open(row)">
          <h3>{{ row.title }} <el-tag v-if="row.unread" type="danger" size="mini">未读</el-tag></h3>
          <small class="demand-muted">{{ row.requestNo }}</small>
          <p class="demand-preline">{{ row.summary }}</p>
          <p class="demand-muted">{{ row.submitterName }} · {{ row.handlerName || '待分派' }}</p>
          <p class="demand-muted">提报 {{ date(row.createTime) }} · 回复 {{ date(row.updateTime) }}</p>
          <div class="demand-card-footer">
            <div class="demand-tags">
              <el-tag size="small">{{ decisions[row.decision] }}</el-tag
              ><el-tag v-if="row.progress !== 'NONE'" type="info" size="small">{{ progresses[row.progress] }}</el-tag>
            </div>
            <el-button type="text" @click.stop="open(row)">查看公示</el-button>
          </div>
        </article>
        <el-empty v-if="!loading && !filtered.length" description="暂无已发布公示" />
      </div>
      <el-drawer
        :visible.sync="visible"
        title="公示详情"
        :size="mobile ? '100%' : '680px'"
        custom-class="demand-detail-drawer"
        ><div v-if="detail">
          <h2>{{ detail.title }}</h2>
          <p class="demand-muted">{{ String(detail.updateTime).replace('T', ' ').substring(0, 16) }}</p>
          <p v-if="detail.formName" class="demand-muted">收集单：{{ plain(detail.formName) }}</p>
          <p class="demand-preline">{{ detail.summary }}</p>
          <el-divider />
          <p class="demand-preline publication-content">{{ detail.content }}</p>
        </div></el-drawer
      >
    </template>
  </section>
</template>
<script>
import { publications, publicationDetail, markRead, exportPublications } from '@/api/demand'
import { decisions, progresses } from '@/utils/demand'
import FormOverview from './components/FormOverview'
import exportMixin from './exportMixin'
export default {
  name: 'DemandPublications',
  components: { FormOverview },
  mixins: [exportMixin],
  data() {
    return {
      rows: [],
      keyword: '',
      submitRange: [],
      formKeyword: '',
      loading: false,
      error: '',
      visible: false,
      detail: null,
      mobile: window.innerWidth < 768,
      wide: window.innerWidth >= 1200,
      decisions,
      progresses,
      selectedFormKey: '',
      selectedFormName: ''
    }
  },
  computed: {
    forms() {
      const groups = new Map()
      this.rows.forEach((row) => {
        const key = row.formKey || ''
        const group = groups.get(key) || {
          formKey: key,
          formName: row.formName || '未命名收集单',
          total: 0,
          unread: 0,
          lastUpdate: ''
        }
        group.total += 1
        if (row.unread) group.unread += 1
        if (row.updateTime && String(row.updateTime) > String(group.lastUpdate)) group.lastUpdate = row.updateTime
        groups.set(key, group)
      })
      return Array.from(groups.values()).sort((a, b) =>
        String(b.lastUpdate).localeCompare(String(a.lastUpdate))
      )
    },
    filteredForms() {
      const keyword = this.formKeyword.trim()
      if (!keyword) return this.forms
      return this.forms.filter((form) => this.plain(form.formName).includes(keyword))
    },
    filtered() {
      const start = this.submitRange[0]
      const end = this.submitRange[1]
      return this.rows.filter((r) => {
        const day = String(r.createTime || '').substring(0, 10)
        return (
          r.formKey === this.selectedFormKey &&
          (r.title.includes(this.keyword) || r.summary.includes(this.keyword)) &&
          (!start || day >= start) &&
          (!end || day <= end)
        )
      })
    }
  },
  created() {
    this.load()
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  },
  methods: {
    resize() {
      this.mobile = window.innerWidth < 768
      this.wide = window.innerWidth >= 1200
    },
    async load() {
      this.loading = true
      try {
        this.rows = (await publications()).data || []
      } catch (e) {
        this.error = e.msg || '无法加载公示，请重试。'
      } finally {
        this.loading = false
      }
    },
    selectForm(item) {
      this.selectedFormKey = item.formKey
      this.selectedFormName = this.plain(item.formName)
      this.keyword = ''
      this.submitRange = []
    },
    backToForms() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.keyword = ''
      this.submitRange = []
    },
    async open(row) {
      this.detail = (await publicationDetail(row.id)).data
      this.visible = true
      await markRead({ type: 'PUBLICATION', id: row.id, version: this.detail.version })
      row.unread = false
      window.dispatchEvent(new Event('demand-updated'))
    },
    plain(value) {
      return new DOMParser().parseFromString(value || '', 'text/html').body.textContent || ''
    },
    meta(row) {
      return `${row.requestNo || ''} · ${this.plain(row.formName)}`
    },
    exportExcel() {
      return this.saveExport(
        () =>
          exportPublications({
            formKey: this.selectedFormKey,
            keyword: this.keyword,
            submitStart: this.submitRange[0] || '',
            submitEnd: this.submitRange[1] || ''
          }),
        '需求公示'
      )
    },
    date(value) {
      return value ? String(value).replace('T', ' ').substring(0, 16) : ''
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
.publication-content {
  line-height: 1.9;
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
