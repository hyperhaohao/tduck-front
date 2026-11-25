<template>
  <section class="demand-page">
    <div class="demand-title-row">
      <div>
        <h1>用户管理</h1>
        <p class="demand-subtitle">
          维护部门、成员与部门主管；仅组织架构管理者可编辑，其他成员按所属部门查看。
        </p>
      </div>
    </div>
    <org-structure />
  </section>
</template>
<script>
import OrgStructure from './components/OrgStructure'
export default {
  name: 'DemandUsers',
  components: { OrgStructure }
}
</script>
