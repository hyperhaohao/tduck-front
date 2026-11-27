<template>
  <section class="demand-page" v-loading="loading">
    <div class="demand-title-row">
      <div>
        <h1>消息中心</h1>
        <p class="demand-subtitle">新公示、我的需求回复、分派与待填报提醒都会汇总在这里。</p>
      </div>
    </div>
    <div class="demand-toolbar">
      <el-radio-group v-model="filter" size="small" @change="search">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="unread">未读</el-radio-button>
      </el-radio-group>
      <el-select
        v-model="kind"
        size="small"
        clearable
        placeholder="全部类型"
        style="width: 140px"
        @change="search"
      >
        <el-option v-for="(label, key) in kindLabels" :key="key" :label="label" :value="key" />
      </el-select>
      <el-button
        class="notice-read-all"
        size="small"
        :disabled="!rows.some((row) => row.unread)"
        @click="readAll"
        >全部已读</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="!loading && !rows.length" class="notice-empty">
      <i class="el-icon-chat-dot-round" />
      <p>{{ filter === 'unread' ? '暂无未读消息' : '暂无消息' }}</p>
    </div>
    <div v-else class="notice-list">
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        class="notice-row"
        :class="{ 'is-unread': row.unread }"
        @click="open(row)"
      >
        <span class="notice-dot" aria-hidden="true" />
        <span class="notice-body">
          <span class="notice-title-line">
            <el-tag size="mini" :type="tagType(row.kind)">{{ kindLabels[row.kind] || row.kind }}</el-tag>
            <el-tag v-if="row.kind === 'APPROVAL' && row.stepNo" size="mini" type="info"
              >第{{ row.stepNo }}级</el-tag
            >
            <span class="notice-title">{{ row.title }}</span>
            <span class="notice-time">{{ date(row.createTime) }}</span>
          </span>
          <span class="notice-content">{{ row.content }}</span>
        </span>
      </button>
    </div>
    <div v-if="total > size" class="notice-pager">
      <el-pagination
        background
        layout="prev, pager, next"
        :current-page.sync="page"
        :page-size="size"
        :total="total"
        @current-change="load"
      />
    </div>
  </section>
</template>

<script>
import { notices as listNotices, readNotice, readAllNotices } from '@/api/demand'

const kindLabels = {
  PUBLICATION: '新公示',
  NEW_DEMAND: '新需求',
  REPLY: '正式回复',
  RESULT: '处理结果',
  ASSIGN: '分派',
  FOLLOWUP: '追问',
  REQUIRED: '待填报',
  APPROVAL: '待审批',
  APPROVAL_RESULT: '审批结果'
}

export default {
  name: 'DemandNotices',
  data() {
    return {
      rows: [],
      total: 0,
      page: 1,
      size: 20,
      kind: '',
      filter: 'unread',
      loading: false,
      error: '',
      kindLabels
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
        const result = await listNotices({
          kind: this.kind || '',
          unreadOnly: this.filter === 'unread',
          page: this.page,
          size: this.size
        })
        const data = result.data || {}
        this.rows = data.rows || []
        this.total = Number(data.total) || 0
      } catch (e) {
        this.error = e.msg || '消息加载失败，请重试。'
      } finally {
        this.loading = false
      }
    },
    search() {
      this.page = 1
      this.load()
    },
    async open(row) {
      if (row.unread) {
        try {
          await readNotice(row.id)
          row.unread = false
          window.dispatchEvent(new Event('demand-updated'))
        } catch (e) {
          /* 已读失败不阻塞跳转。 */
        }
      }
      const demandId = row.demandId
      if (row.kind === 'PUBLICATION' && row.publicationId) {
        this.$router.push({ path: '/demand/publications', query: { id: row.publicationId } })
      } else if (row.kind === 'REQUIRED') {
        this.$router.push('/demand/home')
      } else if (row.kind === 'APPROVAL') {
        this.$router.push({ path: '/demand/approvals', query: demandId ? { id: demandId } : {} })
      } else if (row.kind === 'ASSIGN' || row.kind === 'FOLLOWUP' || row.kind === 'NEW_DEMAND') {
        this.$router.push({ path: '/demand/pending', query: demandId ? { id: demandId } : {} })
      } else if (demandId) {
        this.$router.push({ path: '/demand/mine', query: { id: demandId } })
      }
    },
    async readAll() {
      try {
        await readAllNotices()
        this.rows.forEach((row) => {
          row.unread = false
        })
        window.dispatchEvent(new Event('demand-updated'))
        if (this.filter === 'unread') this.load()
      } catch (e) {
        this.error = e.msg || '操作失败，请重试。'
      }
    },
    tagType(kind) {
      if (kind === 'PUBLICATION' || kind === 'FOLLOWUP' || kind === 'APPROVAL') return 'warning'
      if (kind === 'REQUIRED') return 'danger'
      if (kind === 'REPLY' || kind === 'RESULT' || kind === 'APPROVAL_RESULT') return 'success'
      if (kind === 'ASSIGN') return 'info'
      return ''
    },
    date(value) {
      if (!value) return ''
      return String(value).replace('T', ' ').substring(0, 16)
    }
  }
}
</script>

<style lang="scss" scoped>
.notice-read-all {
  margin-left: auto;
}
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.notice-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #eef1f6;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.notice-row:hover {
  border-color: #d7e1f0;
  box-shadow: 0 2px 10px rgba(31, 45, 61, 0.06);
}
.notice-row.is-unread {
  background: #fbfdff;
}
.notice-dot {
  width: 8px;
  height: 8px;
  margin-top: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: transparent;
}
.notice-row.is-unread .notice-dot {
  background: #f56c6c;
}
.notice-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.notice-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.notice-title {
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-time {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: 12px;
  color: #8a94a6;
}
.notice-content {
  color: #5c6675;
  font-size: 13px;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  white-space: pre-line;
  word-break: break-all;
}
.notice-empty {
  padding: 64px 16px;
  text-align: center;
  color: #8a94a6;
}
.notice-empty i {
  font-size: 40px;
  color: #c6cfdd;
}
.notice-empty p {
  margin-top: 10px;
}
.notice-pager {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
@media (max-width: 767px) {
  .notice-title-line {
    flex-wrap: wrap;
  }
  .notice-time {
    margin-left: 0;
  }
  .notice-content {
    -webkit-line-clamp: 4;
  }
}
</style>
