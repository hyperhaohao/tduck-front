<template><div v-loading="true" class="entry-loading" aria-label="正在加载首页" /></template>
<script>
import { refreshDemand } from '@/utils/demand'
export default {
  name: 'DemandEntry',
  async created() {
    try {
      const c = await refreshDemand()
      this.$router.replace(c.enabled ? '/demand/home' : '/home')
    } catch (e) {
      this.$router.replace('/demand/home')
    }
  }
}
</script>
<style scoped>
.entry-loading {
  min-height: 50vh;
}
</style>
