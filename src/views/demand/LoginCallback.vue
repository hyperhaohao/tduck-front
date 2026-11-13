<template>
  <main class="callback-page">
    <el-result v-if="error" icon="warning" title="登录未完成" :sub-title="error"
      ><el-button slot="extra" type="primary" @click="$router.replace('/login/entry')">重新登录</el-button></el-result
    >
    <div v-else v-loading="true" aria-label="正在完成登录" class="callback-loading" />
  </main>
</template>
<script>
import { exchangeLogin } from '@/api/demand'
import { refreshDemand, safeLocalPath } from '@/utils/demand'
export default {
  name: 'DemandLoginCallback',
  data() {
    return { error: '' }
  },
  async created() {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const ticket = fragment.get('ticket')
    const returnPath = safeLocalPath(fragment.get('returnPath'))
    window.history.replaceState(null, '', window.location.pathname)
    if (!ticket) {
      this.error = '登录凭证已过期，请重新登录。'
      return
    }
    try {
      const response = await exchangeLogin(ticket)
      await this.$store.dispatch('user/login', response.data)
      await refreshDemand()
      this.$router.replace(returnPath)
    } catch (e) {
      this.error = '请重新登录后再试。'
    }
  }
}
</script>
<style scoped>
.callback-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: grid;
  place-items: center;
}
.callback-loading {
  min-width: 260px;
  min-height: 200px;
}
</style>
