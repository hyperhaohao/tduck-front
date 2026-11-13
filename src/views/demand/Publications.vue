<template>
  <section class="demand-page" v-loading="loading">
    <h1>需求公示</h1>
    <p class="demand-subtitle">查看已审核发布的需求摘要、采纳结果与正式进展。</p>
    <div class="demand-toolbar">
      <el-input v-model="keyword" placeholder="搜索公示标题或摘要" clearable prefix-icon="el-icon-search" />
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
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
        <p class="demand-preline">{{ detail.summary }}</p>
        <el-divider />
        <p class="demand-preline publication-content">{{ detail.content }}</p>
      </div></el-drawer
    >
  </section>
</template>
<script>
import { publications, publicationDetail, markRead } from '@/api/demand'
import { decisions, progresses } from '@/utils/demand'
export default {
  name: 'DemandPublications',
  data() {
    return {
      rows: [],
      keyword: '',
      loading: false,
      error: '',
      visible: false,
      detail: null,
      mobile: window.innerWidth < 768,
      decisions,
      progresses
    }
  },
  computed: {
    filtered() {
      return this.rows.filter((r) => r.title.includes(this.keyword) || r.summary.includes(this.keyword))
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
        this.rows = (await publications()).data
      } catch (e) {
        this.error = e.msg || '无法加载公示，请重试。'
      } finally {
        this.loading = false
      }
    },
    async open(row) {
      this.detail = (await publicationDetail(row.id)).data
      this.visible = true
      await markRead({ type: 'PUBLICATION', id: row.id, version: this.detail.version })
      row.unread = false
      window.dispatchEvent(new Event('demand-updated'))
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
@media (max-width: 767px) {
  .publication-grid {
    grid-template-columns: 1fr;
  }
}
</style>
