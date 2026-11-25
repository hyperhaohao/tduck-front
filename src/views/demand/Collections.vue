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
      <div class="demand-pill-group" role="group" aria-label="按状态筛选收集单">
        <button
          v-for="item in statusOptions"
          :key="item.value"
          type="button"
          class="demand-pill"
          :class="{ 'is-active': statusFilter === item.value }"
          @click="statusFilter = item.value"
        >
          <span class="demand-pill-dot" :style="{ backgroundColor: item.color }" />{{ item.label }}
        </button>
      </div>
      <div class="demand-toolbar-end">
        <el-input
          v-model="keyword"
          placeholder="搜索需求收集单"
          clearable
          prefix-icon="el-icon-search"
          aria-label="搜索需求收集单"
        />
      </div>
    </div>
    <div v-if="isHome && logged && isGlobal" class="demand-sort-bar">
      <span class="demand-muted">
        {{
          filtersActive
            ? '清空搜索与状态筛选后可调整收集单顺序'
            : '拖动卡片右侧手柄，调整所有用户看到的收集单顺序'
        }}
      </span>
      <div v-if="sortDirty" class="demand-sort-actions">
        <el-button size="small" @click="load">放弃修改</el-button>
        <el-button
          type="primary"
          size="small"
          :loading="sortSaving"
          :disabled="filtersActive"
          @click="saveSort"
          >保存排序</el-button
        >
      </div>
    </div>
    <draggable
      :list="visibleForms"
      :disabled="!dragEnabled"
      :animation="180"
      handle=".demand-card-drag"
      tag="div"
      class="collection-grid demand-card-grid"
      :class="{ 'is-sortable': dragEnabled }"
      @end="onSortEnd"
    >
      <article
        v-for="form in visibleForms"
        :key="form.formKey"
        class="demand-card demand-card-full"
        :class="{ 'is-ended': expired(form) }"
      >
        <demand-card-cover label="需求收集" />
        <div class="demand-card-body">
          <div class="demand-card-title-row">
            <h3
              class="demand-card-title"
              :class="{ 'is-clickable': !expired(form) }"
              :title="plain(form.name)"
              @click="openForm(form)"
            >
              {{ plain(form.name) }}
            </h3>
            <button
              v-if="dragEnabled"
              type="button"
              class="demand-card-drag"
              title="拖动调整顺序"
              aria-label="拖动调整顺序"
              @click.stop
            >
              <i class="el-icon-rank" />
            </button>
          </div>
          <p class="demand-card-desc" :title="form.summary || plain(form.description)">
            {{ form.summary || plain(form.description) || '欢迎提交你的需求和建议。' }}
          </p>
          <div class="demand-card-meta">
            <span class="demand-card-status" :class="expired(form) ? 'is-ended' : 'is-live'">
              <span class="demand-card-status-dot" aria-hidden="true" />
              <span>{{ expired(form) ? '已截止' : '收集中' }}</span>
            </span>
            <span class="demand-card-meta-end">{{ deadlineText(form) }}</span>
          </div>
          <div class="demand-tags demand-card-tags">
            <el-tag v-if="form.collectOnly" size="small" type="info">只收集</el-tag>
            <el-tag v-if="form.visibility === 'SELECTED'" size="small" type="warning">指定人员</el-tag>
            <el-tag v-if="form.allowAnonymous" size="small" type="info">可匿名</el-tag>
            <el-tag v-if="form.requiredOfMe" size="small" type="warning">本人必填</el-tag>
            <el-tag v-if="form.requiredOfMe && form.requiredSubmitted" size="small" type="success">已提交</el-tag>
            <el-tag v-if="form.requiredOfMe && !form.requiredSubmitted" size="small" type="danger"
              >未提交</el-tag
            >
          </div>
          <p
            v-if="form.requiredOfMe && form.allowAnonymous"
            class="demand-muted collection-required-tip"
          >
            匿名提交不计入必填完成
          </p>
        </div>
        <div class="demand-card-actions">
          <div class="demand-card-actions-main">
            <el-button
              size="mini"
              class="demand-card-action is-primary"
              :disabled="canEnter(form) && expired(form)"
              @click="enterForm(form)"
              >{{ canEnter(form) ? '填写' : '查看需求' }}</el-button
            >
          </div>
        </div>
      </article>
    </draggable>
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
import draggable from 'vuedraggable'
import { listForms, listRequests, sortForms } from '@/api/demand'
import { decisions, progresses, demandState } from '@/utils/demand'
import DemandCardCover from './components/DemandCardCover'
export default {
  name: 'DemandCollections',
  components: { DemandCardCover, draggable },
  data() {
    return {
      forms: [],
      recent: [],
      keyword: '',
      statusFilter: '',
      statusOptions: [
        { value: '', label: '全部', color: '#3370ff' },
        { value: 'live', label: '收集中', color: '#409eff' },
        { value: 'ended', label: '已截止', color: '#f56c6c' }
      ],
      loading: false,
      error: '',
      sortSaving: false,
      sortDirty: false,
      decisions,
      progresses
    }
  },
  computed: {
    logged() {
      return !!this.$store.getters['user/isLogin']
    },
    isHome() {
      return this.$route.path.endsWith('/home')
    },
    filtered() {
      return this.forms.filter((form) => {
        const keywordMatch =
          this.plain(form.name).includes(this.keyword) ||
          (form.summary || '').includes(this.keyword)
        const statusMatch =
          !this.statusFilter || (this.statusFilter === 'ended' ? this.expired(form) : !this.expired(form))
        return keywordMatch && statusMatch
      })
    },
    isGlobal() {
      return demandState.global
    },
    filtersActive() {
      return !!this.keyword.trim() || !!this.statusFilter
    },
    dragEnabled() {
      return (
        this.isHome &&
        this.logged &&
        this.isGlobal &&
        !this.filtersActive &&
        !this.loading &&
        !this.sortSaving &&
        this.forms.length > 1
      )
    },
    visibleForms() {
      return this.filtersActive ? this.filtered : this.forms
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
        this.sortDirty = false
        if (this.logged && this.isHome)
          this.recent = (await listRequests({ scope: 'mine', page: 1, size: 5 })).data.rows
      } catch (e) {
        this.error = e.msg || '暂时无法加载收集单，请重试。'
      } finally {
        this.loading = false
      }
    },
    onSortEnd(event) {
      if (event && event.oldIndex !== event.newIndex) this.sortDirty = true
    },
    async saveSort() {
      if (!this.sortDirty || this.sortSaving || this.filtersActive) return
      this.sortSaving = true
      try {
        await sortForms(this.forms.map((form) => form.formKey))
        this.$message.success('收集单顺序已保存')
        this.sortDirty = false
        await this.load()
      } catch (e) {
        await this.load()
      } finally {
        this.sortSaving = false
      }
    },
    plain(value) {
      return new DOMParser().parseFromString(value || '', 'text/html').body.textContent || ''
    },
    expired(form) {
      const ends = [form.endTime, form.roundEndTime]
        .filter(Boolean)
        .map((value) => new Date(value).getTime())
        .filter((value) => !Number.isNaN(value))
      return ends.length > 0 && Math.min(...ends) < Date.now()
    },
    deadlineText(form) {
      if (form.roundEndTime) {
        return '本轮截止：' + String(form.roundEndTime).replace('T', ' ').substring(0, 16)
      }
      return form.endTime ? '截止：' + this.date(form.endTime) : '长期有效'
    },
    date(value) {
      return String(value).substring(0, 10)
    },
    login() {
      this.$router.push({ path: '/login/entry', query: { redirect: this.$route.fullPath } })
    },
    canEnter(form) {
      if (form.visibility === 'LOGIN') return true
      return !!form.canFill
    },
    enterForm(form) {
      if (this.canEnter(form)) {
        if (!this.expired(form)) this.write(form)
        return
      }
      this.$router.push('/demand/pending')
    },
    write(form) {
      this.$router.push(`/s/${form.formKey}`)
    },
    openForm(form) {
      this.enterForm(form)
    }
  }
}
</script>
<style scoped>
.demand-sort-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.demand-sort-actions {
  display: flex;
  gap: 8px;
}
.demand-card-drag {
  flex: none;
  border: 0;
  background: transparent;
  color: #909399;
  cursor: move;
  padding: 2px 4px;
  line-height: 1;
  font-size: 16px;
}
.demand-card-drag:hover {
  color: #3370ff;
}
.is-sortable .demand-card {
  cursor: move;
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
.collection-required-tip {
  margin: 6px 0 0;
  font-size: 12px;
}
@media (max-width: 767px) {
  .recent-item {
    flex-direction: column;
  }
}
</style>
