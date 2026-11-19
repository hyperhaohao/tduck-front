<template>
  <div class="org-structure" v-loading="loading">
    <div class="org-toolbar">
      <div class="demand-pill-group" role="group" aria-label="组织架构视图">
        <button
          type="button"
          class="demand-pill"
          :class="{ 'is-active': view === 'dept' }"
          @click="view = 'dept'"
        >
          按部门
        </button>
        <button
          type="button"
          class="demand-pill"
          :class="{ 'is-active': view === 'user' }"
          @click="view = 'user'"
        >
          按用户
        </button>
      </div>
      <el-input
        v-if="view === 'user'"
        v-model="userKeyword"
        class="org-user-search"
        placeholder="搜索成员"
        clearable
        prefix-icon="el-icon-search"
      />
    </div>

    <div v-if="view === 'dept'" class="org-layout">
      <aside class="org-dept-panel">
        <div class="org-panel-head">
          <strong>部门</strong>
          <el-button type="text" size="mini" @click="openCreate(null)">新增部门</el-button>
        </div>
        <el-tree
          v-if="departmentTree.length"
          class="org-tree"
          :data="departmentTree"
          node-key="deptKey"
          default-expand-all
          highlight-current
          :expand-on-click-node="false"
          :current-node-key="selectedDeptKey === '__none__' ? null : selectedDeptKey"
          @node-click="selectDept"
        >
          <template slot-scope="{ data }">
            <div class="org-tree-row">
              <span class="org-tree-name" :title="departmentLabel(data.deptKey)">{{ data.name }}</span>
              <span class="org-tree-count">{{ Number(data.memberCount || 0) }} 人</span>
              <span class="org-tree-actions" @click.stop>
                <el-button type="text" size="mini" @click="openCreate(data)">添加下级</el-button>
                <el-button type="text" size="mini" @click="openEdit(data)">编辑</el-button>
                <el-button type="text" size="mini" class="danger-text" @click="removeDept(data)"
                  >删除</el-button
                >
              </span>
            </div>
          </template>
        </el-tree>
        <el-empty v-else :image-size="60" description="暂无部门，点击新增部门" />
        <button type="button" class="org-unassigned" :class="{ 'is-active': selectedDeptKey === '__none__' }" @click="selectedDeptKey = '__none__'">
          未分配成员<span>{{ unassignedMembers.length }}</span>
        </button>
      </aside>

      <section class="org-member-panel">
        <div class="org-panel-head">
          <strong>{{ memberPanelTitle }}</strong>
          <span v-if="selectedDept" class="demand-muted org-panel-path">{{ departmentLabel(selectedDept.deptKey) }}</span>
        </div>
        <div v-if="selectedDept" class="org-add-member">
          <el-select
            v-model="memberToAdd"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="搜索姓名添加成员"
            class="org-member-select"
            @visible-change="visible => visible && searchUsers('')"
          >
            <el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" />
          </el-select>
          <el-button type="primary" :disabled="!memberToAdd" @click="addMember">添加成员</el-button>
        </div>
        <div class="org-member-list">
          <div v-for="row in currentMembers" :key="row.userId + ':' + row.deptKey" class="org-member-row">
            <span class="org-avatar">{{ (row.name || '').slice(0, 1) }}</span>
            <span class="org-member-name">{{ row.name }}</span>
            <el-button
              v-if="selectedDept"
              type="text"
              size="mini"
              class="danger-text"
              @click="removeMember(row)"
              >移除</el-button
            >
          </div>
          <el-empty v-if="!currentMembers.length" :image-size="60" description="暂无成员" />
        </div>
      </section>
    </div>

    <div v-else class="org-user-grid">
      <article v-for="user in filteredUsers" :key="user.userId" class="org-user-card">
        <div class="org-user-head">
          <span class="org-avatar">{{ (user.name || '').slice(0, 1) }}</span>
          <strong class="org-user-name">{{ user.name }}</strong>
          <el-button type="text" size="mini" @click="openUser(user)">编辑部门</el-button>
        </div>
        <div class="org-user-depts">
          <el-tag v-for="label in user.deptLabels" :key="label" size="small">{{ label }}</el-tag>
          <span v-if="!user.deptLabels.length" class="demand-muted">未分配部门</span>
        </div>
      </article>
      <el-empty v-if="!filteredUsers.length" description="暂无成员" />
    </div>

    <el-dialog
      :title="deptForm.deptKey ? '编辑部门' : '新增部门'"
      :visible.sync="deptDialogVisible"
      :width="dialogWidth"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item label="部门名称"
          ><el-input v-model="deptForm.name" maxlength="100" placeholder="请输入部门名称"
        /></el-form-item>
        <el-form-item label="上级部门"
          ><el-cascader
            v-model="deptForm.parentKey"
            :options="parentOptions"
            :props="parentProps"
            clearable
            placeholder="不选为顶级部门"
            style="width: 100%"
        /></el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="deptForm.sortNo" :min="0" :max="9999"
        /></el-form-item>
      </el-form>
      <span slot="footer"
        ><el-button @click="deptDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="deptSaving" @click="saveDept">保存</el-button></span
      >
    </el-dialog>

    <el-dialog
      :title="'编辑 ' + userForm.name + ' 的部门'"
      :visible.sync="userDialogVisible"
      :width="dialogWidth"
      append-to-body
    >
      <el-tree
        ref="userDeptTree"
        :data="departmentTree"
        node-key="deptKey"
        show-checkbox
        check-strictly
        default-expand-all
        :props="{ label: 'name', children: 'children' }"
        empty-text="暂无部门"
      />
      <span slot="footer"
        ><el-button @click="userDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="userSaving" @click="saveUser">保存</el-button></span
      >
    </el-dialog>
  </div>
</template>

<script>
import * as api from '@/api/demand'
export default {
  name: 'DemandOrgStructure',
  data() {
    return {
      loading: false,
      view: 'dept',
      departments: [],
      roster: [],
      selectedDeptKey: '',
      memberToAdd: '',
      candidates: [],
      userKeyword: '',
      deptDialogVisible: false,
      deptSaving: false,
      deptForm: { deptKey: '', name: '', parentKey: null, sortNo: 0 },
      userDialogVisible: false,
      userSaving: false,
      userForm: { userId: '', name: '', deptKeys: [] },
      parentProps: {
        value: 'deptKey',
        label: 'name',
        children: 'children',
        checkStrictly: true,
        emitPath: false
      }
    }
  },
  computed: {
    dialogWidth() {
      return window.innerWidth < 768 ? '94%' : '520px'
    },
    departmentTree() {
      const nodes = new Map()
      this.departments.forEach((department) => {
        nodes.set(department.deptKey, {
          deptKey: department.deptKey,
          name: department.name,
          parentKey: department.parentKey,
          sortNo: department.sortNo,
          memberCount: department.memberCount,
          children: []
        })
      })
      const roots = []
      this.departments.forEach((department) => {
        const node = nodes.get(department.deptKey)
        const parent = department.parentKey ? nodes.get(department.parentKey) : null
        if (parent && parent !== node) parent.children.push(node)
        else roots.push(node)
      })
      return roots
    },
    parentOptions() {
      const excluded = this.deptForm.deptKey
      const filter = (nodes) =>
        nodes
          .filter((node) => node.deptKey !== excluded)
          .map((node) => ({ ...node, children: filter(node.children) }))
      return filter(this.departmentTree)
    },
    selectedDept() {
      return this.departments.find((department) => department.deptKey === this.selectedDeptKey) || null
    },
    currentMembers() {
      if (this.selectedDeptKey === '__none__') return this.roster.filter((row) => !row.deptKey)
      if (!this.selectedDeptKey) return []
      return this.roster.filter((row) => row.deptKey === this.selectedDeptKey)
    },
    unassignedMembers() {
      return this.roster.filter((row) => !row.deptKey)
    },
    memberPanelTitle() {
      if (this.selectedDeptKey === '__none__') return '未分配成员'
      return this.selectedDept ? this.selectedDept.name + ' · 成员' : '成员'
    },
    userCards() {
      const users = new Map()
      this.roster.forEach((row) => {
        const userId = String(row.userId)
        if (!users.has(userId)) users.set(userId, { userId, name: row.name, deptKeys: [], deptLabels: [] })
        if (row.deptKey) {
          const user = users.get(userId)
          user.deptKeys.push(row.deptKey)
          const label = this.departmentLabel(row.deptKey)
          if (!user.deptLabels.includes(label)) user.deptLabels.push(label)
        }
      })
      return [...users.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'))
    },
    filteredUsers() {
      const keyword = this.userKeyword.trim()
      if (!keyword) return this.userCards
      return this.userCards.filter((user) => String(user.name).includes(keyword))
    }
  },
  mounted() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const [departments, roster] = await Promise.all([api.departments(), api.departmentRoster()])
        this.departments = departments.data || []
        this.roster = roster.data || []
        if (
          this.selectedDeptKey &&
          this.selectedDeptKey !== '__none__' &&
          !this.departments.some((department) => department.deptKey === this.selectedDeptKey)
        )
          this.selectedDeptKey = ''
        if (!this.selectedDeptKey)
          this.selectedDeptKey = this.departments.length ? this.departments[0].deptKey : '__none__'
      } finally {
        this.loading = false
      }
    },
    departmentLabel(deptKey) {
      const names = []
      const seen = new Set()
      let current = this.departments.find((department) => department.deptKey === deptKey)
      while (current && !seen.has(current.deptKey)) {
        seen.add(current.deptKey)
        names.unshift(current.name)
        current = current.parentKey
          ? this.departments.find((department) => department.deptKey === current.parentKey)
          : null
      }
      return names.join(' / ')
    },
    selectDept(data) {
      this.selectedDeptKey = data.deptKey
    },
    openCreate(parent) {
      this.deptForm = {
        deptKey: '',
        name: '',
        parentKey: parent ? parent.deptKey : this.selectedDept ? this.selectedDept.deptKey : null,
        sortNo: 0
      }
      this.deptDialogVisible = true
    },
    openEdit(data) {
      this.deptForm = {
        deptKey: data.deptKey,
        name: data.name,
        parentKey: data.parentKey || null,
        sortNo: Number(data.sortNo || 0)
      }
      this.deptDialogVisible = true
    },
    async saveDept() {
      const name = this.deptForm.name.trim()
      if (!name) return this.$message.warning('请输入部门名称')
      this.deptSaving = true
      try {
        const payload = { name, parentKey: this.deptForm.parentKey || null, sortNo: this.deptForm.sortNo }
        if (this.deptForm.deptKey) {
          await api.updateDepartment(this.deptForm.deptKey, payload)
          this.$message.success('部门已保存')
        } else {
          const created = await api.createDepartment(payload)
          this.selectedDeptKey = (created.data && created.data.deptKey) || this.selectedDeptKey
          this.$message.success('部门已新增')
        }
        this.deptDialogVisible = false
        await this.load()
      } finally {
        this.deptSaving = false
      }
    },
    async removeDept(data) {
      try {
        await this.$confirm(`确认删除部门「${data.name}」？有下级、成员或收集单授权时不能删除。`, '删除部门', {
          type: 'warning',
          confirmButtonText: '确认删除',
          cancelButtonText: '取消'
        })
      } catch (e) {
        return
      }
      try {
        await api.removeDepartment(data.deptKey)
      } catch (e) {
        return
      }
      this.$message.success('部门已删除')
      await this.load()
    },
    async searchUsers(keyword) {
      this.candidates = (await api.users(keyword)).data || []
    },
    async addMember() {
      if (!this.memberToAdd || !this.selectedDept) return
      await api.addOrgMember(this.selectedDept.deptKey, this.memberToAdd)
      this.$message.success('成员已添加')
      this.memberToAdd = ''
      await this.load()
    },
    async removeMember(row) {
      await api.removeOrgMember(this.selectedDept.deptKey, row.userId)
      this.$message.success('成员已移除')
      await this.load()
    },
    openUser(user) {
      this.userForm = { userId: user.userId, name: user.name, deptKeys: [...user.deptKeys] }
      this.userDialogVisible = true
      this.$nextTick(() => {
        if (this.$refs.userDeptTree) this.$refs.userDeptTree.setCheckedKeys(this.userForm.deptKeys)
      })
    },
    async saveUser() {
      this.userSaving = true
      try {
        const keys = this.$refs.userDeptTree ? this.$refs.userDeptTree.getCheckedKeys() : []
        await api.setUserDepartments(this.userForm.userId, keys)
        this.$message.success('成员部门已保存')
        this.userDialogVisible = false
        await this.load()
      } finally {
        this.userSaving = false
      }
    }
  }
}
</script>

<style scoped>
.org-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.org-user-search {
  width: 240px;
}
.org-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.org-dept-panel {
  flex: 0 0 280px;
  min-width: 0;
  border: 1px solid #eaebee;
  border-radius: 12px;
  padding: 12px;
  background: #fcfdfe;
}
.org-member-panel {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid #eaebee;
  border-radius: 12px;
  padding: 12px;
}
.org-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.org-panel-path {
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.org-tree {
  margin-bottom: 8px;
}
.org-tree-row {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.org-tree-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.org-tree-count {
  flex: 0 0 auto;
  color: #8f959e;
  font-size: 12px;
}
.org-tree-actions {
  flex: 0 0 auto;
  display: none;
}
.org-tree-row:hover .org-tree-actions {
  display: inline-flex;
}
.org-tree-actions .el-button + .el-button {
  margin-left: 2px;
}
.org-unassigned {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #646a73;
  cursor: pointer;
  font-size: 13px;
}
.org-unassigned:hover,
.org-unassigned.is-active {
  background: #f1f2f5;
}
.org-add-member {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.org-member-select {
  flex: 1 1 auto;
  min-width: 0;
}
.org-member-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.org-member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
}
.org-member-row:hover {
  background: #f7f9fc;
}
.org-member-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.org-avatar {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ebf2ff;
  color: #3370ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}
.org-user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.org-user-card {
  border: 1px solid #eaebee;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}
.org-user-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.org-user-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.org-user-depts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
@media (max-width: 767px) {
  .org-layout {
    flex-direction: column;
  }
  .org-dept-panel {
    flex-basis: auto;
    width: 100%;
  }
  .org-member-panel {
    width: 100%;
  }
  .org-user-search {
    width: 100%;
  }
  .org-tree-actions {
    display: inline-flex;
  }
}
</style>
