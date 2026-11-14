<template>
  <div id="app">
    <RouterView v-if="isRouterAlive" />
  </div>
</template>

<script>
import TduckForm from 'tduck-form-generator'
import { getCurrentDomain } from '@/utils'
import { brand, resolveSystemName } from '@/config/brand'
function cachedName() {
  try {
    return resolveSystemName(JSON.parse(localStorage.getItem('systemConfig') || '{}')?.systemName)
  } catch (e) {
    return brand.name
  }
}

export default {
  provide() {
    return {
      reload: this.reload
    }
  },
  data() {
    return {
      isRouterAlive: true,
      systemName: cachedName()
    }
  },
  watch: {
    $route: 'routeChange'
  },
  async created() {
    window.tduckBaseUrl = process.env['VUE_APP_API_ROOT']
    if (process.env['VUE_APP_API_ROOT']) {
      localStorage.setItem(TduckForm.constant.BASE_URL, process.env['VUE_APP_API_ROOT'])
    } else {
      localStorage.setItem(TduckForm.constant.BASE_URL, getCurrentDomain())
    }
    // 获取系统配置并存储到 localStorage
    try {
      const sysRes = await this.$api.get('/public/systemInfoConfig')
      const systemConfig = typeof sysRes.data === 'string' ? JSON.parse(sysRes.data) : sysRes.data || {}
      systemConfig.systemName = resolveSystemName(systemConfig.systemName)
      this.systemName = systemConfig.systemName
      localStorage.setItem('systemConfig', JSON.stringify(systemConfig))
    } catch (error) {
      console.error('获取系统配置失败:', error)
    }
    window.aMapKey = process.env['VUE_APP_MAP_KEY']
    window.aMapSecurityJsCode = process.env['VUE_APP_SECURITY_JSCODE']
    console.log('更新日期：2026 年 5 月 22 日 10:52:08')
  },
  methods: {
    reload() {
      this.isRouterAlive = false
      this.$nextTick(() => (this.isRouterAlive = true))
    },
    routeChange(newVal, oldVal) {
      if (newVal.name == oldVal.name) {
        this.reload()
      }
    }
  },
  metaInfo() {
    const name = this.systemName
    return { titleTemplate: (title) => (title ? `${title} - ${name}` : name) }
  }
}
</script>
