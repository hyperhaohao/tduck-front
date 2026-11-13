<template>
  <section class="demand-page">
    <h1>匿名需求查询</h1>
    <p class="demand-subtitle">使用提交成功时领取的需求编号和查询码，查看本项需求的回复与进度。</p>
    <el-form class="lookup-form" label-position="top" @submit.native.prevent="search"
      ><el-form-item label="需求编号"
        ><el-input v-model="form.requestNo" placeholder="请输入需求编号" autocomplete="off" /></el-form-item
      ><el-form-item label="查询码"
        ><el-input
          v-model="form.queryCode"
          placeholder="请输入提交后领取的查询码"
          show-password
          autocomplete="off" /></el-form-item
      ><el-button type="primary" :loading="loading" native-type="submit">查询回复与进度</el-button></el-form
    >
    <p class="demand-muted">请妥善保管查询码；匿名需求不会自动关联到登录账户。</p>
    <demand-detail ref="detail" />
  </section>
</template>
<script>
import DemandDetail from './components/DemandDetail'
export default {
  name: 'DemandLookup',
  components: { DemandDetail },
  data() {
    const receipt = this.$route.params.receipt || {}
    return { form: { requestNo: receipt.requestNo || '', queryCode: receipt.queryCode || '' }, loading: false }
  },
  methods: {
    async search() {
      if (!this.form.requestNo.trim() || !this.form.queryCode.trim())
        return this.$message.warning('请填写需求编号和查询码')
      this.loading = true
      try {
        await this.$refs.detail.open('', { ...this.form })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
<style scoped>
.lookup-form {
  max-width: 520px;
  margin: 28px 0;
}
.lookup-form + .demand-muted {
  font-size: 13px;
  line-height: 1.8;
}
</style>
