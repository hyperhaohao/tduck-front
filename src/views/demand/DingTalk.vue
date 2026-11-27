<template>
  <div class="demand-page dingtalk-page">
    <div class="page-head">
      <div>
        <h1>钉钉配置</h1>
        <p class="demand-muted">
          配置企业内部应用凭证、推送事件、通讯录映射和待办创建人。密钥只保存在服务器受控文件中，不回显。
        </p>
      </div>
    </div>
    <component :is="dingtalkPanel" />
  </div>
</template>
<script>
import DingTalkPanel from './components/DingTalkPanel'

export default {
  name: 'DemandDingTalk',
  components: { DingTalkPanel },
  data() {
    return { dingtalkPanel: DingTalkPanel }
  }
}
</script>
<style scoped>
.dingtalk-page {
  display: grid;
  gap: 16px;
}
.page-head h1 {
  margin: 0 0 6px;
  font-size: 20px;
}
</style>
