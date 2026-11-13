<template>
  <section class="demand-page" v-loading="loading">
    <div class="demand-title-row">
      <div>
        <h1>{{ isHome ? '首页' : '需求收集' }}</h1>
        <p class="demand-subtitle">选择收集单提交需求，在“我的需求”查看回复与进度。</p>
      </div>
      <el-button v-if="!logged" type="primary" @click="login">登录</el-button>
    </div>
    <el-alert
      v-if="!logged"
      title="默认登录填写；开放匿名填写的收集单也可直接填报。"
      type="info"
      :closable="false"
      show-icon
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="demand-error"
      ><el-button type="text" @click="load">重新加载</el-button></el-alert
    >
    <div class="demand-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索需求收集单"
        clearable
        prefix-icon="el-icon-search"
        aria-label="搜索需求收集单"
      />
    </div>
    <div class="collection-grid">
      <article v-for="form in filtered" :key="form.formKey" class="demand-card collection-card">
        <div class="collection-label">
          <el-tag :type="expired(form) ? 'info' : 'success'" size="small">{{
            expired(form) ? '已截止' : '收集中'
          }}</el-tag
          ><span v-if="form.allowAnonymous" class="demand-muted">可匿名</span>
        </div>
        <h3>{{ plain(form.name) }}</h3>
        <p>{{ form.summary || plain(form.description) || '欢迎提交你的需求和建议。' }}</p>
        <div class="demand-card-footer">
          <span class="demand-muted">{{ form.endTime ? '截止：' + date(form.endTime) : '长期有效' }}</span
          ><el-button type="primary" :disabled="expired(form)" @click="write(form)">填写</el-button>
        </div>
      </article>
    </div>
    <el-empty
      v-if="!loading && !filtered.length && !error"
      :description="logged ? '暂无可填写的需求收集单' : '暂无开放匿名填写的收集单，登录后查看更多'"
    />
    <section v-if="isHome && logged" class="recent-section">
      <h2>我的最近需求 <el-button type="text" @click="$router.push('/demand/mine')">查看全部</el-button></h2>
      <div v-if="recent.length" class="recent-list">
        <div
          v-for="item in recent"
          :key="item.id"
          class="recent-item"
          @click="$router.push({ path: '/demand/mine', query: { id: item.id } })"
        >
          <span>{{ item.title }}</span>
          <div class="demand-tags">
            <el-tag v-if="item.unread" size="small" type="danger">未读</el-tag
            ><el-tag size="small">{{ decisions[item.decision] }}</el-tag
            ><span class="demand-muted">{{ progresses[item.progress] }}</span>
          </div>
        </div>
      </div>
      <p v-else class="demand-muted">提交后的需求会显示在这里。</p>
    </section>
  </section>
</template>
<script>
import { listForms, listRequests } from '@/api/demand'
import { decisions, progresses } from '@/utils/demand'
export default {
  name: 'DemandCollections',
  data() {
    return { forms: [], recent: [], keyword: '', loading: false, error: '', decisions, progresses }
  },
  computed: {
    logged() {
      return !!this.$store.getters['user/isLogin']
    },
    isHome() {
      return this.$route.path.endsWith('/home')
    },
    filtered() {
      return this.forms.filter(
        (f) => this.plain(f.name).includes(this.keyword) || (f.summary || '').includes(this.keyword)
      )
    }
  },
  created() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      this.error = ''
      try {
        this.forms = (await listForms()).data || []
        if (this.logged && this.isHome)
          this.recent = (await listRequests({ scope: 'mine', page: 1, size: 5 })).data.rows
      } catch (e) {
        this.error = e.msg || '暂时无法加载收集单，请重试。'
      } finally {
        this.loading = false
      }
    },
    plain(value) {
      return new DOMParser().parseFromString(value || '', 'text/html').body.textContent || ''
    },
    expired(form) {
      return form.endTime && new Date(form.endTime).getTime() < Date.now()
    },
    date(value) {
      return String(value).substring(0, 10)
    },
    login() {
      this.$router.push({ path: '/login/entry', query: { redirect: this.$route.fullPath } })
    },
    write(form) {
      this.$router.push(`/s/${form.formKey}`)
    }
  }
}
</script>
<style scoped>
.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}
.collection-card {
  display: flex;
  flex-direction: column;
}
.collection-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
}
.collection-card p {
  flex: 1;
  margin: 0;
  overflow-wrap: anywhere;
}
.recent-section {
  margin-top: 36px;
}
.recent-section h2 {
  font-size: 18px;
  font-weight: 500;
}
.recent-list {
  display: grid;
}
.recent-item {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}
.recent-item > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .collection-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .recent-item {
    flex-direction: column;
  }
}
</style>
