<template>
  <div class="demand-shell" :class="{ collapsed }">
    <header class="demand-header">
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
      <div class="header-account">
        <template v-if="logged"
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
            <el-menu-item v-if="logged && state.handler" index="/demand/pending"
              ><i class="el-icon-tickets" /><span slot="title"
                >待我处理
                <el-badge
                  :value="counts.pending"
                  :max="99"
                  :hidden="!counts.pending"
                  class="nav-count"
                  title="尚未办结的需求数" /></span
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
            <el-menu-item v-if="logged && state.admin" index="/demand/admin"
              ><i class="el-icon-setting" /><span slot="title">后台管理</span></el-menu-item
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
        publicationUnread: badgeValue(this.state.publicationUnread)
      }
    },
    activeNotices() {
      return [
        { path: '/demand/mine', label: '我的需求：未读', icon: 'el-icon-document', count: this.counts.mineUnread },
        {
          path: '/demand/pending',
          label: '待我处理：待办',
          icon: 'el-icon-tickets',
          count: this.state.handler ? this.counts.pending : 0
        },
        {
          path: '/demand/publications',
          label: '需求公示：未读',
          icon: 'el-icon-bell',
          count: this.counts.publicationUnread
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
      Object.assign(this.state, { admin: false, handler: false, mineUnread: 0, pending: 0, publicationUnread: 0 })
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
  color: #303133;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}
.demand-header {
  height: 68px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 18px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}
.demand-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #303133;
  font-weight: 600;
  font-size: 18px;
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
  gap: 18px;
}
.demand-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}
.demand-sidebar {
  width: 224px;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  padding: 16px 8px;
  box-sizing: border-box;
  border-right: 1px solid #ebeef5;
  overflow-y: auto;
}
.demand-sidebar .el-menu {
  border: 0;
  background: transparent;
}
.demand-sidebar .el-menu-item,
.demand-sidebar .el-submenu__title {
  border-radius: 10px;
  height: 50px;
  line-height: 50px;
}
.demand-sidebar .el-menu-item.is-active {
  background: #eff4ff;
  color: #3370ff;
}
.demand-sidebar .el-menu-item:hover,
.demand-sidebar .el-submenu__title:hover {
  background: #f7f8fa;
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
  color: #909399;
  font-size: 12px;
}
.demand-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
  box-sizing: border-box;
}
.collapsed .demand-sidebar {
  width: 80px;
}
.collapsed .demand-sidebar .el-menu--collapse {
  width: 64px;
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
  border: 1px solid #ebeef5;
  border-radius: 16px;
  padding: 28px;
  min-height: calc(100% - 58px);
  box-sizing: border-box;
}
.demand-page h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}
.demand-subtitle {
  color: #909399;
  margin: 0 0 24px;
  line-height: 1.7;
}
.demand-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin: 22px 0;
}
.demand-toolbar .el-input {
  width: 240px;
}
.demand-toolbar .el-select {
  width: 150px;
}
.demand-page .el-button--primary {
  background: #3370ff;
  border-color: #3370ff;
}
.demand-page .el-pagination {
  margin-top: 24px;
  white-space: normal;
}
.demand-page .el-empty {
  padding: 50px 0;
}
.demand-error {
  margin: 20px 0;
}
.demand-muted {
  color: #909399;
}
.demand-link {
  color: #3370ff;
  cursor: pointer;
}
.demand-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.demand-list-mobile {
  display: none;
}
.demand-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.demand-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 20px;
  min-width: 0;
}
.demand-card h3 {
  margin: 0 0 12px;
  font-size: 17px;
}
.demand-card p {
  color: #909399;
  line-height: 1.7;
}
.demand-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
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
@media (max-width: 767px) {
  .demand-header {
    height: 58px;
    padding: 0 12px;
    gap: 10px;
  }
  .demand-brand {
    font-size: 16px;
  }
  .demand-brand > img {
    display: none;
  }
  .header-account {
    gap: 10px;
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
    border-radius: 12px;
  }
  .demand-page h1 {
    font-size: 21px;
  }
  .demand-toolbar {
    gap: 10px;
  }
  .demand-toolbar .el-input,
  .demand-toolbar .el-select {
    width: 100%;
  }
  .demand-title-row {
    flex-wrap: wrap;
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
}
</style>
