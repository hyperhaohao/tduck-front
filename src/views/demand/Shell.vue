<template>
  <div class="demand-shell" :class="{ collapsed }">
    <header class="demand-header">
      <div class="header-left">
        <el-badge :is-dot="mobile && hasNotice && !drawer" class="menu-trigger">
          <el-button
            :icon="collapsed && !mobile ? 'el-icon-s-unfold' : 'el-icon-s-fold'"
            circle
            :aria-label="mobile ? '打开导航菜单' : '收缩或展开导航'"
            :aria-expanded="mobile ? drawer : !collapsed"
            @click="toggleMenu"
          />
        </el-badge>
        <router-link class="demand-brand" to="/demand/home"><BrandLogo :compact="collapsed && !mobile" /></router-link>
      </div>
      <div class="header-account">
        <el-badge
          v-if="logged"
          :value="counts.noticeUnread"
          :max="99"
          :hidden="!counts.noticeUnread"
          class="header-notice"
        >
          <el-button
            icon="el-icon-chat-dot-round"
            circle
            :aria-label="`消息中心，未读 ${counts.noticeUnread}`"
            @click="navigate('/demand/messages')"
          />
        </el-badge>
        <template v-if="logged"
          ><span class="account-avatar" aria-hidden="true"
            ><img v-if="user.avatar" :src="user.avatar" alt="" /><span v-else>{{
              (user.name || '员工').slice(0, 1)
            }}</span></span
          ><span class="account-name">{{ user.name || '员工' }}</span
          ><el-button type="text" @click="logout">退出登录</el-button></template
        >
        <el-button v-else type="primary" size="small" @click="login">登录</el-button>
      </div>
    </header>
    <div class="demand-body">
      <div v-if="mobile && drawer" class="demand-overlay" @click="drawer = false" />
      <aside class="demand-sidebar" :class="{ 'mobile-open': drawer }" aria-label="主导航">
        <el-menu
          :default-active="$route.path"
          :collapse="!mobile && collapsed"
          :collapse-transition="false"
          :default-openeds="['center']"
          @select="navigate"
        >
          <el-menu-item index="/demand/home"><i class="el-icon-house" /><span slot="title">首页</span></el-menu-item>
          <el-menu-item v-if="logged" index="/demand/messages"
            ><i class="el-icon-chat-dot-round" /><span slot="title"
              >消息中心
              <el-badge
                :value="counts.noticeUnread"
                :max="99"
                :hidden="!counts.noticeUnread"
                class="nav-count"
                title="未读消息数" /></span
          ></el-menu-item>
          <el-menu-item v-if="logged && state.global" index="/demand/dingtalk"
            ><i class="el-icon-chat-line-square" /><span slot="title">钉钉配置</span></el-menu-item
          >
          <el-submenu index="center">
            <template slot="title"><i class="el-icon-folder-opened" /><span>需求中心</span></template>
            <el-menu-item index="/demand/forms"
              ><i class="el-icon-document-add" /><span slot="title">需求收集</span></el-menu-item
            >
            <el-menu-item v-if="logged" index="/demand/mine"
              ><i class="el-icon-document" /><span slot="title"
                >我的需求
                <el-badge
                  :value="counts.mineUnread"
                  :max="99"
                  :hidden="!counts.mineUnread"
                  class="nav-count"
                  title="存在未读更新的需求数" /></span
            ></el-menu-item>
            <el-menu-item v-if="logged && (state.handler || state.manage)" index="/demand/pending"
              ><i class="el-icon-tickets" /><span slot="title"
                >待我处理
                <el-badge
                  :value="counts.pending"
                  :max="99"
                  :hidden="!counts.pending"
                  class="nav-count"
                  title="待办数量（含未答复追问）" /></span
            ></el-menu-item>
            <el-menu-item v-if="logged && state.approver" index="/demand/approvals"
              ><i class="el-icon-s-check" /><span slot="title"
                >待我审批
                <el-badge
                  :value="counts.approvalPending"
                  :max="99"
                  :hidden="!counts.approvalPending"
                  class="nav-count"
                  title="待部门主管审批数量" /></span
            ></el-menu-item>
            <el-menu-item v-if="logged" index="/demand/publications"
              ><i class="el-icon-bell" /><span slot="title"
                >需求公示
                <el-badge
                  :value="counts.publicationUnread"
                  :max="99"
                  :hidden="!counts.publicationUnread"
                  class="nav-count"
                  title="未读公示数" /></span
            ></el-menu-item>
            <el-menu-item v-if="logged && state.documentAccess && !state.global" index="/demand/manage"
              ><i class="el-icon-folder-checked" /><span slot="title">单据管理</span></el-menu-item
            >
            <el-menu-item v-if="logged && state.global" index="/demand/admin"
              ><i class="el-icon-setting" /><span slot="title">后台管理</span></el-menu-item
            >
            <el-menu-item v-if="logged && state.org" index="/demand/users"
              ><i class="el-icon-user" /><span slot="title">用户管理</span></el-menu-item
            >
            <el-menu-item index="/demand/lookup"
              ><i class="el-icon-search" /><span slot="title">匿名需求查询</span></el-menu-item
            >
          </el-submenu>
        </el-menu>
        <div v-if="collapsed && !mobile && hasNotice" class="collapsed-notices">
          <el-tooltip v-for="notice in activeNotices" :key="notice.path" :content="notice.label" placement="right"
            ><button
              class="collapsed-notice"
              :aria-label="`${notice.label} ${notice.count}`"
              @click="navigate(notice.path)"
            >
              <el-badge :value="notice.count" :max="99"><i :class="notice.icon" /></el-badge></button
          ></el-tooltip>
        </div>
        <div v-if="!collapsed || mobile" class="sidebar-foot">需求有回应 · 进度可追踪</div>
      </aside>
      <main class="demand-main" tabindex="-1"><router-view :key="$route.path" /></main>
    </div>
  </div>
</template>
<script>
import { demandState, refreshDemand, badgeValue } from '@/utils/demand'
export default {
  name: 'DemandShell',
  data() {
    return {
      state: demandState,
      collapsed: localStorage.getItem('rm-sidebar-collapsed') === 'true',
      mobile: window.innerWidth < 768,
      drawer: false,
      timer: null
    }
  },
  computed: {
    logged() {
      return !!this.$store.getters['user/isLogin']
    },
    user() {
      try {
        return JSON.parse(this.$store.getters['user/userInfo'] || '{}')
      } catch (e) {
        return {}
      }
    },
    counts() {
      return {
        mineUnread: badgeValue(this.state.mineUnread),
        pending: badgeValue(this.state.pending),
        publicationUnread: badgeValue(this.state.publicationUnread),
        noticeUnread: badgeValue(this.state.noticeUnread),
        approvalPending: badgeValue(this.state.approvalPending)
      }
    },
    activeNotices() {
      return [
        { path: '/demand/mine', label: '我的需求：未读', icon: 'el-icon-document', count: this.counts.mineUnread },
        {
          path: '/demand/pending',
          label: '待我处理：待办',
          icon: 'el-icon-tickets',
          count: this.state.handler || this.state.manage ? this.counts.pending : 0
        },
        {
          path: '/demand/approvals',
          label: '待我审批：待办',
          icon: 'el-icon-s-check',
          count: this.state.approver ? this.counts.approvalPending : 0
        },
        {
          path: '/demand/publications',
          label: '需求公示：未读',
          icon: 'el-icon-bell',
          count: this.counts.publicationUnread
        },
        {
          path: '/demand/messages',
          label: '消息中心：未读',
          icon: 'el-icon-chat-dot-round',
          count: this.counts.noticeUnread
        }
      ].filter((n) => n.count > 0)
    },
    hasNotice() {
      return this.logged && this.activeNotices.length > 0
    }
  },
  created() {
    this.refresh()
    this.timer = setInterval(() => {
      if (!document.hidden) this.refresh()
    }, 30000)
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', this.focusRefresh)
    window.addEventListener('demand-updated', this.refresh)
    window.addEventListener('keydown', this.escape)
  },
  beforeDestroy() {
    clearInterval(this.timer)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('visibilitychange', this.focusRefresh)
    window.removeEventListener('demand-updated', this.refresh)
    window.removeEventListener('keydown', this.escape)
  },
  methods: {
    async refresh() {
      try {
        await refreshDemand()
      } catch (e) {
        /* 接口已显示错误，保持上次有效计数等待重试。 */
      }
    },
    resize() {
      const previous = this.mobile
      this.mobile = window.innerWidth < 768
      if (previous !== this.mobile) this.drawer = false
    },
    focusRefresh() {
      if (!document.hidden) this.refresh()
    },
    escape(e) {
      if (e.key === 'Escape') this.drawer = false
    },
    toggleMenu() {
      if (this.mobile) this.drawer = !this.drawer
      else {
        this.collapsed = !this.collapsed
        localStorage.setItem('rm-sidebar-collapsed', String(this.collapsed))
      }
    },
    navigate(path) {
      this.drawer = false
      this.$router.push(path)
    },
    login() {
      this.$router.push({ path: '/login/entry', query: { redirect: this.$route.fullPath } })
    },
    async logout() {
      await this.$store.dispatch('user/logout')
      Object.assign(this.state, {
        admin: false,
        documentAccess: false,
        formManage: false,
        org: false,
        userManage: false,
        permissionApi: false,
        granted: [],
        global: false,
        handler: false,
        manage: false,
        mineUnread: 0,
        pending: 0,
        publicationUnread: 0,
        noticeUnread: 0,
        approvalPending: 0,
        approver: false
      })
      this.$router.replace('/demand/home')
    }
  }
}
</script>
<style lang="scss">
.demand-shell {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
  color: #1f2329;
  overflow: hidden;
}
.demand-header {
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px 0 20px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(190%);
  -webkit-backdrop-filter: blur(20px) saturate(190%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 100;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 230px;
  min-width: 0;
}
.demand-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-decoration: none;
  color: #1f2329;
  font-weight: 600;
}
.demand-brand > img {
  width: 78px;
  height: 28px;
  object-fit: contain;
}
.header-account {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.account-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef4ff, #dbe8ff);
  color: #3370ff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.account-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.demand-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}
.demand-sidebar {
  width: 230px;
  flex-shrink: 0;
  margin: 20px 0 20px 20px;
  padding: 16px 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
  overflow-y: auto;
}
.demand-sidebar::-webkit-scrollbar {
  width: 0;
}
.demand-sidebar .el-menu {
  border: 0;
  background: transparent;
}
.demand-sidebar .el-menu-item,
.demand-sidebar .el-submenu__title {
  height: 44px;
  line-height: 44px;
  padding: 0 16px;
  margin-bottom: 6px;
  border-radius: 12px;
  color: #515154;
  font-size: 14.5px;
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.demand-sidebar .el-menu-item i,
.demand-sidebar .el-submenu__title i {
  margin-right: 12px;
  color: #86868b;
  font-size: 16px;
  transition: all 0.25s ease;
}
.demand-sidebar .el-menu-item span,
.demand-sidebar .el-submenu__title span {
  transition: transform 0.25s ease;
}
.demand-sidebar .el-menu-item:hover,
.demand-sidebar .el-submenu__title:hover {
  background: rgba(0, 0, 0, 0.035);
  color: #1d1d1f;
}
.demand-sidebar .el-menu-item:hover i,
.demand-sidebar .el-submenu__title:hover i {
  color: #1d1d1f;
  transform: scale(1.1);
}
.demand-sidebar .el-menu-item:hover span,
.demand-sidebar .el-submenu__title:hover span {
  transform: translateX(2px);
}
.demand-sidebar .el-menu-item.is-active {
  background: linear-gradient(135deg, #3370ff 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 8px 20px rgba(51, 112, 255, 0.25);
  font-weight: 600;
}
.demand-sidebar .el-menu-item.is-active i {
  color: #ffffff !important;
}
.demand-sidebar .el-menu-item.is-active:hover span {
  transform: none;
}
.demand-sidebar .nav-count {
  margin-left: 8px;
  vertical-align: baseline;
}
.demand-sidebar .el-badge__content {
  border: 0;
}
.sidebar-foot {
  margin-top: auto;
  padding: 30px 12px 4px;
  color: #86868b;
  font-size: 11px;
}
.demand-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 20px 20px 0;
  box-sizing: border-box;
}
.collapsed .demand-sidebar {
  width: 80px;
  margin: 20px 0 20px 20px;
}
.collapsed .demand-sidebar .el-menu--collapse {
  width: 56px;
}
.collapsed-notices {
  display: grid;
  gap: 20px;
  justify-content: center;
  padding-top: 28px;
}
.collapsed-notice {
  border: 0;
  background: transparent;
  color: #606266;
  font-size: 20px;
  padding: 8px;
  cursor: pointer;
}
.demand-page {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  padding: 38px;
  min-height: 100%;
  box-sizing: border-box;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
}
.demand-page h1 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
  letter-spacing: -0.5px;
}
.demand-subtitle {
  color: #646a73;
  font-size: 13px;
  margin: 0;
  line-height: 1.7;
}
.demand-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 0 4px;
  margin-bottom: 24px;
}
.demand-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid #eaebee;
  border-radius: 12px;
  padding: 8px 12px;
  margin: 0 0 20px;
  box-shadow: 0 4px 12px rgba(31, 35, 41, 0.02);
}
.demand-toolbar > .el-input {
  width: 220px;
}
.demand-toolbar > .el-select {
  width: 150px;
}
.demand-toolbar > .el-date-editor {
  width: 280px;
}
.demand-toolbar .el-input__inner,
.demand-toolbar .el-textarea__inner {
  background: #f1f2f5;
  border: 1px solid transparent;
  border-radius: 8px;
  height: 34px;
  line-height: 34px;
  font-size: 13px;
  color: #1f2329;
  transition: all 0.25s ease;
}
.demand-toolbar .el-input__inner::placeholder {
  color: #8f959e;
}
.demand-toolbar .el-input__inner:focus,
.demand-toolbar .el-textarea__inner:focus {
  background: #fff;
  border-color: rgba(51, 112, 255, 0.3);
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.08);
}
.demand-toolbar .el-input__prefix {
  color: #8f959e;
}
.demand-toolbar .el-button {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #646a73;
  background: #f1f2f5;
  border-color: transparent;
}
.demand-toolbar .el-button:hover {
  background: #e8ebf0;
  color: #1f2329;
}
.demand-toolbar .el-button--primary {
  color: #fff;
  background: #3370ff;
  border-color: #3370ff;
}
.demand-toolbar .el-button--primary:hover {
  color: #fff;
  background: #5a8fec;
  border-color: #5a8fec;
}
.demand-toolbar .el-button--text {
  height: auto;
  padding: 0;
  background: transparent;
}
.demand-toolbar-end {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex-wrap: nowrap;
}
.demand-toolbar-end > .el-input {
  width: 220px;
  flex: 0 0 220px;
}
.demand-toolbar-end > .el-select {
  width: 150px;
  flex: 0 0 150px;
}
.demand-toolbar-end > .el-date-editor {
  width: 280px;
  flex: 0 0 280px;
}
.demand-pill-group {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #f1f2f5;
}
.demand-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #646a73;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.demand-pill:hover {
  color: #1f2329;
}
.demand-pill.is-active {
  color: #3370ff;
  background: #fff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(31, 35, 41, 0.08);
}
.demand-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  opacity: 0.65;
}
.demand-pill.is-active .demand-pill-dot {
  opacity: 1;
  transform: scale(1.1);
}
.demand-page > .el-radio-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #f1f2f5;
  margin-bottom: 20px;
}
.demand-page > .el-radio-group .el-radio-button {
  margin: 0;
}
.demand-page > .el-radio-group .el-radio-button__inner {
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent;
  box-shadow: none !important;
  color: #646a73;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
}
.demand-page > .el-radio-group .el-radio-button__inner:hover {
  color: #1f2329;
}
.demand-page > .el-radio-group .el-radio-button.is-active .el-radio-button__inner,
.demand-page > .el-radio-group .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: #fff !important;
  border-color: transparent !important;
  color: #3370ff !important;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(31, 35, 41, 0.08) !important;
}
.demand-page > .el-radio-group .el-radio-button.is-active + .el-radio-button .el-radio-button__inner {
  border-left-color: transparent !important;
}
.demand-page .el-tabs__header {
  margin-bottom: 20px;
}
.demand-page .el-tabs__nav-wrap::after {
  display: none;
}
.demand-page .el-tabs__item {
  height: 40px;
  line-height: 40px;
  padding: 0 18px;
  color: #646a73;
  font-size: 14px;
  font-weight: 500;
}
.demand-page .el-tabs__item.is-active {
  color: #3370ff;
  font-weight: 600;
}
.demand-page .el-tabs__active-bar {
  height: 3px;
  border-radius: 2px;
  background: #3370ff;
}
.demand-page .el-tag {
  border-radius: 6px;
  font-weight: 600;
}
.demand-page .el-button {
  border-radius: 8px;
}
.demand-page .el-button--primary {
  background: #3370ff;
  border-color: #3370ff;
}
.demand-page .el-button--primary:hover {
  background: #5a8fec;
  border-color: #5a8fec;
}
.demand-page .el-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30px;
  white-space: normal;
}
.demand-page .el-pagination .el-pager li,
.demand-page .el-pagination .btn-prev,
.demand-page .el-pagination .btn-next {
  border-radius: 6px;
}
.demand-page .el-table {
  background: transparent;
}
.demand-page .el-table::before {
  display: none;
}
.demand-page .el-table th {
  background: #fcfdfe !important;
  color: #1f2329;
  font-weight: 700;
  font-size: 13px;
  padding: 14px 0;
  border-bottom: 1px solid #eaebee;
}
.demand-page .el-table td {
  color: #1f2329;
  font-size: 13px;
  padding: 14px 0;
  border-bottom: 1px solid #f1f2f5;
}
.demand-page .el-table tr {
  transition: background-color 0.25s ease;
}
.demand-page .el-table tr:hover > td {
  background: #f7f9fc !important;
}
.demand-page .el-table .el-button--text {
  color: #646a73;
  font-weight: 600;
  padding: 0;
}
.demand-page .el-table .el-button--text:hover {
  color: #3370ff;
}
.demand-page .el-table .danger-text,
.demand-page .el-table .danger-text:hover {
  color: #f56c6c;
}
.demand-page .demand-table-compact th,
.demand-page .demand-table-compact td {
  font-size: 13px;
  padding: 10px 0;
}
.demand-page .demand-table-compact .cell {
  padding-left: 6px;
  padding-right: 6px;
}
.demand-table-compact .nowrap-cell .cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.demand-table-compact .request-title,
.demand-table-compact .request-meta {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.demand-table-compact .request-title .el-tag,
.demand-table-compact .request-meta .el-tag {
  margin-left: 4px;
}
.demand-page .el-empty {
  padding: 50px 0;
}
.demand-error {
  margin: 20px 0;
}
.demand-muted {
  color: #8f959e;
}
.demand-link {
  color: #3370ff;
  cursor: pointer;
}
.demand-list-mobile {
  display: none;
}
.demand-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.demand-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  align-items: stretch;
  min-width: 0;
}
.demand-card-grid > .el-empty {
  grid-column: 1 / -1;
}
.demand-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid #eaebee;
  border-radius: 16px;
  box-shadow: 0 4px 18px rgba(31, 35, 41, 0.03);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.demand-card-full,
.demand-card-compact {
  padding: 0;
}
.demand-card-clickable {
  cursor: pointer;
}
.demand-card-clickable:focus-visible {
  outline: 2px solid rgba(51, 112, 255, 0.45);
  outline-offset: 2px;
}
@media (hover: hover) and (pointer: fine) {
  .demand-card:hover {
    border-color: rgba(51, 112, 255, 0.25);
    box-shadow: 0 18px 34px rgba(31, 35, 41, 0.08);
  }
  .demand-card-clickable:hover {
    transform: translateY(-4px);
  }
  .demand-card-clickable:hover .demand-card-title {
    color: #3370ff;
  }
}
.demand-card-cover {
  position: relative;
  flex: 0 0 110px;
  height: 110px;
  overflow: hidden;
  border-bottom: 1px solid #f1f2f5;
  background: radial-gradient(140px 90px at 84% 16%, rgba(51, 112, 255, 0.1), transparent 70%),
    linear-gradient(135deg, #eef4ff 0%, #f7faff 58%, #fff 100%);
}
.demand-card-cover-pattern {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3370ff;
  opacity: 0.55;
  transition: transform 0.4s ease, opacity 0.4s ease;
}
.demand-card-cover-pattern svg {
  width: 70px;
  height: 70px;
}
.demand-card:hover .demand-card-cover-pattern {
  transform: scale(1.05);
  opacity: 0.75;
}
.demand-card-full.is-voided .demand-card-cover,
.demand-card-full.is-ended .demand-card-cover {
  filter: grayscale(0.35);
  opacity: 0.78;
}
.demand-card-type {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(51, 112, 255, 0.08);
  color: #3370ff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.2px;
}
.demand-card-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 18px 14px;
}
.demand-card-title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.demand-card-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: #1f2329;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.demand-card-title.is-clickable {
  cursor: pointer;
}
.demand-card-title.is-clickable:hover {
  color: #3370ff;
}
.demand-card-title-row > .el-tag {
  flex: 0 0 auto;
  margin-top: 2px;
}
.demand-card-desc {
  margin: 8px 0 0;
  color: #8f959e;
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.demand-card-kicker {
  margin-top: 4px;
  color: #8f959e;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.demand-card-line {
  margin-top: 6px;
  color: #646a73;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.demand-card-time {
  margin-top: 6px;
  color: #8f959e;
  font-size: 12px;
}
.demand-card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-top: 12px;
  color: #8f959e;
  font-size: 12px;
}
.demand-card-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  white-space: nowrap;
}
.demand-card-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c0c4cc;
}
.demand-card-status.is-live {
  color: #409eff;
}
.demand-card-status.is-live .demand-card-status-dot {
  background: #409eff;
  animation: demand-pulse 2s infinite;
}
.demand-card-status.is-idle,
.demand-card-status.is-ended {
  color: #8f959e;
}
.demand-card-status.is-voided {
  color: #d9534f;
}
.demand-card-status.is-voided .demand-card-status-dot {
  background: #f56c6c;
}
.demand-card-meta-end {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.demand-card-count {
  font-variant-numeric: tabular-nums;
}
.demand-card-tags {
  margin-top: auto;
  padding-top: 10px;
  gap: 6px;
}
@keyframes demand-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(51, 112, 255, 0.35);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(51, 112, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(51, 112, 255, 0);
  }
}
.demand-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 50px;
  padding: 10px 14px;
  background: #fcfdfe;
  border-top: 1px solid #f1f2f5;
}
.demand-card-actions-main {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.demand-card-actions .el-button {
  margin: 0;
}
.demand-card-action.el-button {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}
.demand-card-action.is-primary {
  color: #3370ff;
  background: #eef4ff;
  border-color: transparent;
}
.demand-card-action.is-primary:hover,
.demand-card-action.is-primary:focus {
  color: #fff;
  background: #3370ff;
  border-color: #3370ff;
}
.demand-card-action.is-primary.is-disabled,
.demand-card-action.is-primary:disabled {
  color: #c0c4cc;
  background: #f5f7fa;
  border-color: #e4e7ed;
}
.demand-card-action.is-secondary {
  color: #646a73;
  background: transparent;
  border-color: #eaebee;
}
.demand-card-action.is-secondary:hover,
.demand-card-action.is-secondary:focus {
  color: #1f2329;
  background: #f1f2f5;
  border-color: #d1d5db;
}
.demand-card-link {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  color: #3370ff;
  background: #eef4ff;
  font-size: 12px;
  font-weight: 600;
}
.demand-card-more {
  flex: 0 0 auto;
  margin-left: auto;
}
.demand-card-more-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #8f959e;
  font: inherit;
  outline: none;
  cursor: pointer;
}
.demand-card-more-trigger:hover,
.demand-card-more-trigger:focus-visible {
  background: #f1f2f5;
  color: #1f2329;
  box-shadow: 0 0 0 2px rgba(51, 112, 255, 0.22);
}
.demand-card-more-menu.el-dropdown-menu {
  min-width: 148px;
  padding: 6px;
  border: 1px solid #eaebee;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(31, 35, 41, 0.12);
}
.demand-card-more-menu .el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  color: #1f2329;
  font-size: 13px;
  line-height: 1.4;
}
.demand-card-more-menu .el-dropdown-menu__item--divided {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid #f1f2f5;
}
.demand-card-more-menu .el-dropdown-menu__item--divided::before {
  display: none;
}
.demand-card-more-menu .el-dropdown-menu__item i {
  margin-right: 0;
}
.demand-card-more-menu .el-dropdown-menu__item.is-warning {
  color: #b88230;
}
.demand-card-more-menu .el-dropdown-menu__item.is-danger {
  color: #f56c6c;
}
.demand-card-more-menu .el-dropdown-menu__item.is-warning:hover {
  background: rgba(230, 162, 60, 0.08);
  color: #b88230;
}
.demand-card-more-menu .el-dropdown-menu__item.is-danger:hover {
  background: rgba(245, 108, 108, 0.08);
  color: #f56c6c;
}
.demand-card-compact .demand-card-body {
  padding: 16px 18px 14px;
}
.demand-card-compact .demand-card-title {
  font-size: 15px;
}
.demand-preline {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.demand-detail-drawer .el-drawer__body {
  overflow-y: auto;
  padding: 0 24px 24px;
}
.demand-detail-drawer .el-drawer__header {
  margin-bottom: 18px;
  color: #303133;
}
.demand-detail-drawer .el-form-item__content {
  overflow-wrap: anywhere;
}
.demand-detail-drawer .el-tabs__content {
  overflow: visible;
}
.demand-detail-drawer .el-textarea__inner {
  resize: vertical;
}
.demand-detail-drawer .el-button--primary {
  background: #3370ff;
  border-color: #3370ff;
}
.demand-overlay {
  display: none;
}
@media (max-width: 1200px) {
  .demand-main {
    padding: 16px 16px 16px 0;
  }
  .demand-page {
    padding: 24px;
  }
  .demand-sidebar {
    margin: 16px 0 16px 16px;
  }
}
@media (max-width: 767px) {
  .demand-header {
    height: 58px;
    padding: 0 12px;
  }
  .header-left {
    width: auto;
    gap: 8px;
  }
  .demand-brand {
    font-size: 16px;
  }
  .demand-brand > img {
    display: none;
  }
  .header-account {
    gap: 8px;
  }
  .account-avatar {
    width: 30px;
    height: 30px;
    font-size: 12px;
  }
  .account-name {
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .demand-sidebar,
  .collapsed .demand-sidebar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 240px;
    margin: 0;
    border-radius: 0 20px 20px 0;
    z-index: 1002;
    transform: translateX(-100%);
    transition: transform 0.2s;
  }
  .demand-sidebar.mobile-open {
    transform: translateX(0);
  }
  .demand-overlay {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1001;
  }
  .demand-main {
    padding: 12px;
  }
  .demand-page {
    padding: 18px;
    border-radius: 16px;
  }
  .demand-page h1 {
    font-size: 21px;
  }
  .demand-toolbar {
    gap: 10px;
    padding: 8px 10px;
  }
  .demand-toolbar > .el-input,
  .demand-toolbar > .el-select,
  .demand-toolbar > .el-date-editor {
    width: 100%;
  }
  .demand-toolbar-end {
    width: 100%;
    margin-left: 0;
    flex-wrap: wrap;
  }
  .demand-toolbar-end > .el-input,
  .demand-toolbar-end > .el-select,
  .demand-toolbar-end > .el-date-editor {
    width: 100%;
    flex: 1 1 100%;
  }
  .demand-pill-group {
    width: 100%;
    flex-wrap: wrap;
  }
  .demand-title-row {
    flex-wrap: wrap;
  }
  .demand-card-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  .demand-card-cover {
    flex-basis: 96px;
    height: 96px;
  }
  .demand-card-cover-pattern svg {
    width: 64px;
    height: 64px;
  }
  .demand-card-body,
  .demand-card-compact .demand-card-body {
    padding: 14px 16px 12px;
  }
  .demand-card-actions {
    padding: 10px 12px;
  }
  .demand-card-more-trigger,
  .demand-card-link {
    height: 40px;
  }
  .demand-card-more-trigger {
    width: 40px;
  }
  .demand-list-desktop {
    display: none;
  }
  .demand-list-mobile {
    display: grid;
    gap: 12px;
  }
  .demand-detail-drawer .el-drawer__body {
    padding: 0 16px 20px;
  }
  .demand-detail-drawer .el-drawer__header {
    padding: 18px 16px 0;
  }
  .demand-page .el-button,
  .demand-detail-drawer .el-button {
    min-height: 40px;
  }
  .demand-detail-drawer .el-form-item__label {
    float: none;
    display: block;
    text-align: left;
  }
  .demand-detail-drawer .el-form-item__content {
    margin-left: 0 !important;
  }
}
@media (max-width: 375px) {
  .account-name {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .demand-sidebar {
    transition: none;
  }
  .demand-card {
    transition: none;
  }
  .demand-card:hover {
    transform: none;
  }
  .demand-card-status-dot {
    animation: none !important;
  }
}
</style>
