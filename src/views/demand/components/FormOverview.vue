<template>
  <div class="form-overview" v-loading="loading">
    <article
      v-for="item in items"
      :key="item.formKey"
      class="demand-card form-card"
      role="button"
      tabindex="0"
      :aria-label="`进入${plain(item.formName)}`"
      @click="$emit('select', item)"
      @keyup.enter="$emit('select', item)"
    >
      <h3>{{ plain(item.formName) }}</h3>
      <div class="demand-tags">
        <el-tag size="small">{{ totalLabel }} {{ number(item.total) }}</el-tag
        ><el-tag v-if="number(item.unread)" type="danger" size="small"
          >未读 {{ number(item.unread) }}</el-tag
        ><el-tag v-if="hasPending(item)" type="info" size="small">待办 {{ number(item.pending) }}</el-tag>
      </div>
      <div class="demand-card-footer">
        <span class="demand-muted">{{
          item.lastUpdate ? '最近更新 ' + date(item.lastUpdate) : '暂无更新'
        }}</span
        ><el-button type="text" @click.stop="$emit('select', item)">{{ actionText }}</el-button>
      </div>
    </article>
    <el-empty v-if="!loading && !items.length" :description="emptyText" />
  </div>
</template>
<script>
export default {
  name: 'FormOverview',
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
.form-overview {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
.form-card {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-card:hover,
.form-card:focus {
  border-color: #3370ff;
  outline: none;
  box-shadow: 0 2px 12px rgba(51, 112, 255, 0.12);
}
.form-card h3 {
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .form-overview {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
