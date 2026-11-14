<template>
  <main class="demand-login">
    <section class="login-panel">
      <BrandLogo compact />
      <h1>{{ $brand.name }}</h1>
      <p>提交需求，查看回复与实施进度。</p>
      <el-alert
        v-if="$route.query.failed"
        title="登录未完成或已过期，请重新登录。"
        type="warning"
        :closable="false"
      /><el-button type="primary" :loading="loading" @click="login">登录</el-button
      ><el-button type="text" @click="$router.push('/demand/home')">返回首页</el-button>
    </section>
  </main>
</template>
<script>
import { startLogin } from '@/api/demand'
import { safeLocalPath } from '@/utils/demand'
export default {
  name: 'DemandLogin',
  data() {
    return { loading: false }
  },
  methods: {
    async login() {
      this.loading = true
      try {
        const result = await startLogin(safeLocalPath(this.$route.query.redirect))
        window.location.assign(result.data.url)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
<style scoped>
.demand-login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f5f7;
  padding: 24px;
  box-sizing: border-box;
}
.login-panel {
  width: 100%;
  max-width: 380px;
  padding: 36px;
  background: #fff;
  border-radius: 18px;
  box-sizing: border-box;
  text-align: center;
  border: 1px solid #ebeef5;
}
.login-panel img {
  width: 110px;
}
.login-panel h1 {
  font-size: 24px;
  color: #303133;
  margin-top: 28px;
}
.login-panel p {
  color: #909399;
  line-height: 1.7;
  margin-bottom: 30px;
}
.login-panel > .el-button--primary {
  display: block;
  width: 100%;
  margin: 24px 0 8px;
  background: #3370ff;
  border-color: #3370ff;
}
</style>
