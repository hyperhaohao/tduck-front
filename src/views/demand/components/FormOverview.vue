<template>
  <div class="form-overview demand-card-grid" v-loading="loading">
    <article
      v-for="item in items"
      :key="item.formKey"
      class="demand-card demand-card-full demand-card-clickable form-card"
      role="button"
      tabindex="0"
      :aria-label="`进入${plain(item.formName)}`"
      @click="$emit('select', item)"
      @keyup.enter="$emit('select', item)"
    >
      <demand-card-cover :label="totalLabel + '汇总'" />
      <div class="demand-card-body">
        <div class="demand-card-title-row">
          <h3 class="demand-card-title">{{ plain(item.formName) }}</h3>
        </div>
        <div class="demand-card-meta">
          <span class="demand-card-meta-end">{{
            item.lastUpdate ? '最近更新 ' + date(item.lastUpdate) : '暂无更新'
          }}</span>
        </div>
        <div class="demand-tags demand-card-tags">
          <el-tag size="small">{{ totalLabel }} {{ number(item.total) }}</el-tag
          ><el-tag v-if="number(item.unread)" type="danger" size="small"
            >未读 {{ number(item.unread) }}</el-tag
          ><el-tag v-if="hasPending(item)" type="info" size="small">待办 {{ number(item.pending) }}</el-tag>
        </div>
      </div>
      <div class="demand-card-actions">
        <div class="demand-card-actions-main">
          <span class="demand-card-link">{{ actionText }}</span>
        </div>
      </div>
    </article>
    <el-empty v-if="!loading && !items.length" :description="emptyText" />
  </div>
</template>
<script>
import DemandCardCover from './DemandCardCover'
export default {
  name: 'FormOverview',
  components: { DemandCardCover },
  props: {
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    actionText: { type: String, default: '查看需求' },
    totalLabel: { type: String, default: '需求' },
    emptyText: { type: String, default: '暂无需求' }
  },
  methods: {
    number(value) {
      return Math.max(0, Number(value) || 0)
    },
    hasPending(item) {
      return item.pending !== undefined && item.pending !== null && this.number(item.pending) > 0
    },
    date(value) {
      return String(value).replace('T', ' ').substring(0, 16)
    },
    plain(value) {
      return new DOMParser().parseFromString(value || '', 'text/html').body.textContent || ''
    }
  }
}
</script>
<style scoped>
.form-card {
  cursor: pointer;
}
</style>
