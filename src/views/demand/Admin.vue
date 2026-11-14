<template>
  <section class="demand-page" v-loading="loading">
    <template v-if="allowed"
      ><div class="demand-title-row">
        <div>
          <h1>后台管理</h1>
          <p class="demand-subtitle">管理员创建收集单、设置权限、分派经办并审核公示。</p>
        </div>
        <div class="admin-actions">
          <el-button @click="openRoles">管理员授权</el-button
          ><el-button type="primary" icon="el-icon-plus" @click="createVisible = true">新建收集单</el-button>
        </div>
      </div>
      <el-tabs v-model="tab"
        ><el-tab-pane label="收集单管理" name="forms"
          ><div class="demand-toolbar">
            <el-input v-model="keyword" placeholder="搜索收集单" clearable /><el-button
              @click="$router.push('/project/my')"
              >原表单后台</el-button
            >
          </div>
          <div class="admin-form-list">
            <article v-for="form in filtered" :key="form.formKey" class="demand-card">
              <h3>{{ plain(form.name) }}</h3>
              <p>{{ form.summary || plain(form.description) || '尚未配置需求收集说明' }}</p>
              <div class="demand-tags">
                <el-tag :type="form.published && Number(form.status) === 2 ? 'success' : 'info'" size="small">{{
                  form.published && Number(form.status) === 2 ? '已开放' : '未开放'
                }}</el-tag
                ><el-tag v-if="form.allowAnonymous" size="small" type="info">可匿名</el-tag>
              </div>
              <div class="demand-card-footer admin-card-actions">
                <el-button type="text" @click="editOriginal(form)">设计与发布</el-button
                ><el-button type="text" @click="openConfig(form)">收集配置</el-button
                ><el-button type="text" @click="openMembers(form)">成员权限</el-button>
              </div>
            </article>
          </div>
          <el-empty v-if="!filtered.length" description="暂无收集单，请先新建" /></el-tab-pane
        ><el-tab-pane label="需求总表与公示审核" name="table"
          ><div class="demand-toolbar">
            <el-input v-model="tableKeyword" placeholder="搜索需求" @keyup.enter.native="loadTable" /><el-button
              type="primary"
              @click="loadTable"
              >查询</el-button
            >
          </div>
          <el-table class="demand-list-desktop" :data="rows" @row-click="openDetail"
            ><el-table-column prop="title" label="需求" min-width="220" /><el-table-column
              prop="submitterName"
              label="填报者"
              width="100"
            /><el-table-column prop="handlerName" label="经办人" width="100" /><el-table-column
              label="处理状态"
              min-width="170"
              ><template slot-scope="s"
                >{{ decisions[s.row.decision] }} / {{ progresses[s.row.progress] }}</template
              ></el-table-column
            ><el-table-column label="操作" width="100"
              ><template slot-scope="s"
                ><el-button type="text" @click.stop="openDetail(s.row)">分派 / 公示</el-button></template
              ></el-table-column
            ></el-table
          >
          <div class="demand-list-mobile">
            <article v-for="row in rows" :key="row.id" class="demand-card">
              <h3>{{ row.title }}</h3>
              <p>{{ row.submitterName }} · {{ row.handlerName || '待分派' }}</p>
              <div class="demand-card-footer">
                <span>{{ decisions[row.decision] }} / {{ progresses[row.progress] }}</span
                ><el-button type="text" @click="openDetail(row)">分派 / 公示</el-button>
              </div>
            </article>
          </div>
          <el-pagination
            :current-page.sync="page"
            :page-size="20"
            :total="total"
            layout="total, prev, pager, next"
            :pager-count="5"
            @current-change="loadTable" /></el-tab-pane
      ></el-tabs>
      <el-dialog title="新建需求收集单" :visible.sync="createVisible" :width="dialogWidth" :close-on-click-modal="false"
        ><el-form label-position="top"
          ><el-form-item label="收集单名称"><el-input v-model="createForm.name" maxlength="100" /></el-form-item
          ><el-form-item label="说明"
            ><el-input
              v-model="createForm.description"
              type="textarea"
              :rows="3"
              maxlength="2000" /></el-form-item></el-form
        ><span slot="footer"
          ><el-button @click="createVisible = false">取消</el-button
          ><el-button type="primary" :loading="saving" @click="create">创建并设计</el-button></span
        ></el-dialog
      >
      <el-drawer title="收集配置" :visible.sync="configVisible" :size="drawerWidth" custom-class="demand-detail-drawer"
        ><el-form v-if="selected" label-position="top"
          ><h3>{{ plain(selected.name) }}</h3>
          <el-form-item label="收集说明"
            ><el-input v-model="config.summary" type="textarea" :rows="3" maxlength="2000" /></el-form-item
          ><el-form-item label="填报范围"
            ><el-radio-group v-model="config.visibility" @change="visibilityChanged"
              ><el-radio label="LOGIN">全体登录用户</el-radio
              ><el-radio label="SELECTED">指定人员</el-radio></el-radio-group
            ></el-form-item
          ><el-form-item label="允许匿名填写"
            ><el-switch v-model="config.allowAnonymous" :disabled="config.visibility === 'SELECTED'" />
            <p class="demand-muted">默认登录填写；指定人员收集单不能开放匿名。</p></el-form-item
          ><el-form-item label="截止时间"
            ><el-date-picker
              v-model="config.endTime"
              type="datetime"
              value-format="yyyy-MM-dd HH:mm:ss"
              placeholder="不设置则长期有效"
              style="width: 100%" /></el-form-item
          ><el-form-item label="向首页开放"
            ><el-switch v-model="config.published" />
            <p class="demand-muted">须同时在原表单后台发布，才会进入员工可见列表。</p></el-form-item
          ><el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button></el-form
        ></el-drawer
      >
      <el-drawer
        title="成员与权限"
        :visible.sync="membersVisible"
        :size="drawerWidth"
        custom-class="demand-detail-drawer"
        ><template v-if="selected"
          ><h3>{{ plain(selected.name) }}</h3>
          <p class="demand-muted">填报与经办权限分别授予，可同时拥有。</p>
          <div class="member-picker">
            <el-select
              v-model="memberId"
              filterable
              remote
              :remote-method="searchUsers"
              placeholder="搜索姓名选择人员"
              style="width: 100%"
              ><el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" /></el-select
            ><el-button @click="addMember">添加</el-button>
          </div>
          <div class="member-bulk-bar">
            <el-checkbox v-model="selectAllFill" :indeterminate="fillIndeterminate" :disabled="!memberRows.length"
              >全选可填报</el-checkbox
            ><el-checkbox v-model="selectAllHandle" :indeterminate="handleIndeterminate" :disabled="!memberRows.length"
              >全选可经办</el-checkbox
            ><el-button type="primary" :loading="bulkSaving" :disabled="!memberRows.length" @click="saveAllMembers"
              >一键保存</el-button
            >
          </div>
          <div v-for="member in memberRows" :key="member.userId" class="member-row">
            <strong>{{ member.name }}</strong>
            <div class="member-flags">
              <el-checkbox v-model="member.canFill">可填报</el-checkbox
              ><el-checkbox v-model="member.canHandle">可经办</el-checkbox
              ><el-button type="text" :loading="saving" @click="saveMemberRow(member)">保存</el-button>
            </div>
          </div></template
        ></el-drawer
      >
      <el-drawer title="管理员授权" :visible.sync="rolesVisible" :size="drawerWidth" custom-class="demand-detail-drawer"
        ><p class="demand-muted">管理员也可正常填报，叠加经办权限后可处理分派需求。</p>
        <div class="member-picker">
          <el-select
            v-model="roleUserId"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="选择人员"
            style="width: 100%"
            ><el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" /></el-select
          ><el-button type="primary" :loading="saving" @click="grantRole">授予管理</el-button>
        </div>
        <div v-for="role in roleRows" :key="role.userId" class="member-row">
          <strong>{{ role.name }}</strong
          ><el-button type="text" :loading="saving" @click="revokeRole(role)">撤销管理</el-button>
        </div>
        <p class="demand-muted">系统维护管理员及配置中指定的管理员不会因本列表撤权而失去维护权限。</p></el-drawer
      >
      <demand-detail ref="detail" @updated="loadTable" /></template
    ><el-result v-else icon="warning" title="无后台管理权限" sub-title="请使用具有管理权限的账户访问。" />
  </section>
</template>
<script>
import * as api from '@/api/demand'
import { createFormRequest } from '@/api/project/form'
import { refreshDemand, decisions, progresses } from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
export default {
  name: 'DemandAdmin',
  components: { DemandDetail },
  data() {
    return {
      allowed: false,
      loading: false,
      saving: false,
      bulkSaving: false,
      forms: [],
      keyword: '',
      tab: 'forms',
      selected: null,
      config: {},
      configVisible: false,
      membersVisible: false,
      memberRows: [],
      candidates: [],
      memberId: '',
      rolesVisible: false,
      roleRows: [],
      roleUserId: '',
      createVisible: false,
      createForm: { name: '', description: '' },
      rows: [],
      page: 1,
      total: 0,
      tableKeyword: '',
      mobile: window.innerWidth < 768,
      decisions,
      progresses
    }
  },
  computed: {
    filtered() {
      return this.forms.filter((f) => this.plain(f.name).includes(this.keyword))
    },
    dialogWidth() {
      return this.mobile ? '94%' : '520px'
    },
    drawerWidth() {
      return this.mobile ? '100%' : '560px'
    },
    selectAllFill: {
      get() {
        return this.memberRows.length > 0 && this.memberRows.every((m) => m.canFill)
      },
      set(value) {
        this.memberRows.forEach((m) => {
          m.canFill = value
        })
      }
    },
    selectAllHandle: {
      get() {
        return this.memberRows.length > 0 && this.memberRows.every((m) => m.canHandle)
      },
      set(value) {
        this.memberRows.forEach((m) => {
          m.canHandle = value
        })
      }
    },
    fillIndeterminate() {
      return !this.selectAllFill && this.memberRows.some((m) => m.canFill)
    },
    handleIndeterminate() {
      return !this.selectAllHandle && this.memberRows.some((m) => m.canHandle)
    }
  },
  watch: {
    tab(v) {
      if (v === 'table') this.loadTable()
    }
  },
  async created() {
    this.loading = true
    try {
      this.allowed = (await refreshDemand()).admin
      if (this.allowed) await this.load()
    } finally {
      this.loading = false
    }
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  },
  methods: {
    resize() {
      this.mobile = window.innerWidth < 768
    },
    plain(v) {
      return new DOMParser().parseFromString(v || '', 'text/html').body.textContent || ''
    },
    async load() {
      this.forms = (await api.adminForms()).data
    },
    async create() {
      if (!this.createForm.name.trim()) return this.$message.warning('请填写收集单名称')
      this.saving = true
      try {
        const r = await createFormRequest({ ...this.createForm, type: 'ORDINARY' })
        await api.configureForm(r.data.formKey, {
          summary: this.createForm.description,
          visibility: 'LOGIN',
          allowAnonymous: false,
          published: false
        })
        this.createVisible = false
        this.editOriginal(r.data)
      } finally {
        this.saving = false
      }
    },
    editOriginal(form) {
      this.$router.push({ path: '/project/form', query: { key: form.formKey } })
    },
    openConfig(form) {
      this.selected = form
      this.config = {
        summary: form.summary || '',
        visibility: form.visibility || 'LOGIN',
        allowAnonymous: !!form.allowAnonymous,
        published: !!form.published,
        endTime: form.endTime ? String(form.endTime).replace('T', ' ').substring(0, 19) : null,
        revision: form.revision || 0
      }
      this.configVisible = true
    },
    visibilityChanged(value) {
      if (value === 'SELECTED') this.config.allowAnonymous = false
    },
    async saveConfig() {
      this.saving = true
      try {
        await api.configureForm(this.selected.formKey, this.config)
        this.$message.success('配置已保存')
        this.configVisible = false
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async openMembers(form) {
      if (!form.visibility) {
        this.$message.info('请先保存收集配置，再授权成员')
        this.openConfig(form)
        return
      }
      this.selected = form
      this.memberRows = (await api.members(form.formKey)).data
      this.memberId = ''
      await this.searchUsers('')
      this.membersVisible = true
    },
    async searchUsers(keyword) {
      this.candidates = (await api.users(keyword)).data
    },
    addMember() {
      const user = this.candidates.find((u) => u.id === this.memberId)
      if (!user) return this.$message.warning('请选择人员')
      if (this.memberRows.some((m) => m.userId === user.id)) return this.$message.info('该人员已在列表中')
      this.memberRows.push({ userId: user.id, name: user.name, canFill: false, canHandle: false })
    },
    async saveMemberRow(member) {
      this.saving = true
      try {
        await api.saveMember(this.selected.formKey, member.userId, member)
        this.$message.success('成员权限已保存')
        window.dispatchEvent(new Event('demand-updated'))
      } finally {
        this.saving = false
      }
    },
    async saveAllMembers() {
      if (!this.memberRows.length) return this.$message.warning('请先添加成员')
      this.bulkSaving = true
      let saved = 0
      let failed = 0
      try {
        for (const member of this.memberRows) {
          try {
            await api.saveMember(this.selected.formKey, member.userId, member)
            saved++
          } catch (e) {
            failed++
          }
        }
        if (failed) this.$message.warning(`已保存 ${saved} 人，${failed} 人保存失败，请重试`)
        else this.$message.success('成员权限已保存')
        window.dispatchEvent(new Event('demand-updated'))
      } finally {
        this.bulkSaving = false
      }
    },
    async openRoles() {
      this.roleRows = (await api.admins()).data
      await this.searchUsers('')
      this.rolesVisible = true
    },
    async grantRole() {
      if (!this.roleUserId) return this.$message.warning('请选择人员')
      this.saving = true
      try {
        await api.saveAdmin(this.roleUserId, true)
        this.roleRows = (await api.admins()).data
        this.$message.success('管理权限已授予')
      } finally {
        this.saving = false
      }
    },
    async revokeRole(role) {
      await this.$confirm(`确认撤销 ${role.name} 的管理权限？`, '撤销管理', { type: 'warning' })
      this.saving = true
      try {
        await api.saveAdmin(role.userId, false)
        this.roleRows = (await api.admins()).data
      } finally {
        this.saving = false
      }
    },
    async loadTable() {
      const r = await api.listRequests({ scope: 'table', keyword: this.tableKeyword, page: this.page, size: 20 })
      this.rows = r.data.rows
      this.total = r.data.total
    },
    openDetail(row) {
      this.$refs.detail.open(row.id)
    }
  }
}
</script>
<style scoped>
.admin-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.admin-form-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 18px;
}
.admin-card-actions {
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 14px;
}
.admin-card-actions .el-button {
  margin: 0;
}
.member-picker {
  display: flex;
  gap: 12px;
  margin: 24px 0;
}
.member-bulk-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}
.member-bulk-bar .el-checkbox {
  margin: 0;
}
.member-bulk-bar .el-button {
  margin-left: auto;
}
.member-row {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.member-flags {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.member-flags .el-checkbox {
  margin: 0;
}
@media (max-width: 767px) {
  .admin-form-list {
    grid-template-columns: 1fr;
  }
  .admin-actions .el-button {
    margin: 0;
  }
  .member-picker {
    flex-wrap: wrap;
  }
  .member-bulk-bar .el-button {
    width: 100%;
    margin-left: 0;
  }
}
</style>
