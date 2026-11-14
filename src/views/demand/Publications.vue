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
        <el-input v-model="keyword" placeholder="搜索公示标题或摘要" clearable prefix-icon="el-icon-search" />
      </div>
      <div class="publication-grid">
        <article v-for="row in filtered" :key="row.id" class="demand-card">
          <h3>{{ row.title }} <el-tag v-if="row.unread" type="danger" size="mini">未读</el-tag></h3>
          <p class="demand-preline">{{ row.summary }}</p>
          <div class="demand-card-footer">
            <div class="demand-tags">
              <el-tag size="small">{{ decisions[row.decision] }}</el-tag
              ><el-tag v-if="row.progress !== 'NONE'" type="info" size="small">{{ progresses[row.progress] }}</el-tag>
            </div>
            <el-button type="text" @click="open(row)">查看公示</el-button>
          </div>
        </article>
      </div>
      <el-empty v-if="!loading && !filtered.length" description="暂无已发布公示" /><el-drawer
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
import { publications, publicationDetail, markRead } from '@/api/demand'
import { decisions, progresses } from '@/utils/demand'
import FormOverview from './components/FormOverview'
export default {
  name: 'DemandPublications',
  components: { FormOverview },
  data() {
    return {
      rows: [],
      keyword: '',
      formKeyword: '',
      loading: false,
      error: '',
      visible: false,
      detail: null,
      mobile: window.innerWidth < 768,
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
      return this.rows.filter(
        (r) =>
          r.formKey === this.selectedFormKey &&
          (r.title.includes(this.keyword) || r.summary.includes(this.keyword))
      )
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
    },
    backToForms() {
      this.selectedFormKey = ''
      this.selectedFormName = ''
      this.keyword = ''
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
    }
  }
}
</script>
<style scoped>
.publication-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
@media (max-width: 767px) {
  .publication-grid {
    grid-template-columns: 1fr;
  }
}
</style>
