<template>
  <section class="demand-page" v-loading="loading">
    <template v-if="allowed"
      ><div class="demand-title-row">
        <div>
          <h1>后台管理</h1>
          <p class="demand-subtitle">后台管理员创建收集单、设置权限、分派经办并审核公示；仅显示本人创建或获授权的收集单。</p>
        </div>
        <div class="admin-actions">
          <el-button v-if="isGlobal" @click="openRecycle">全局回收站</el-button
          ><el-button v-if="isGlobal" @click="openRoles">后台管理员授权</el-button
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
                ><el-tag v-if="form.voided" size="small" type="danger">已作废</el-tag
                ><el-tag v-if="Number(form.demandCount) > 0" size="small" type="info"
                  >{{ form.demandCount }} 条需求</el-tag
                ><el-tag v-if="form.allowAnonymous" size="small" type="info">可匿名</el-tag>
              </div>
              <div class="demand-card-footer admin-card-actions">
                <el-button type="text" @click="editOriginal(form)">设计与发布</el-button
                ><el-button type="text" @click="openConfig(form)">收集配置</el-button
                ><el-button type="text" @click="openMembers(form)">成员权限</el-button
                ><el-button v-if="form.visibility" type="text" class="danger-text" @click="toggleVoid(form)">{{
                  form.voided ? '恢复' : '作废'
                }}</el-button
                ><el-button type="text" class="danger-text" @click="deleteCollection(form)">删除</el-button>
              </div>
            </article>
          </div>
          <el-empty v-if="!filtered.length" description="暂无收集单，请先新建" /></el-tab-pane
        ><el-tab-pane label="需求总表与公示审核" name="table"
          ><template v-if="!selectedTableFormKey">
            <div class="demand-toolbar">
              <el-input
                v-model="tableFormKeyword"
                placeholder="搜索收集单"
                clearable
                prefix-icon="el-icon-search"
              /><el-button icon="el-icon-download" :loading="exporting" @click="exportTable"
                >导出全部</el-button
              >
            </div>
            <form-overview
              :items="filteredTableForms"
              :loading="tableFormsLoading"
              action-text="查看需求"
              total-label="需求"
              empty-text="暂无需求"
              @select="selectTableForm"
            />
          </template>
          <template v-else>
            <el-button class="demand-back" type="text" icon="el-icon-back" @click="backToTableForms"
              >全部收集单</el-button
            >
            <h2 class="form-heading">{{ selectedTableFormName }}</h2>
            <div class="demand-toolbar">
              <el-input
                v-model="tableKeyword"
                placeholder="搜索需求"
                clearable
                @keyup.enter.native="searchTable"
              /><el-button type="primary" @click="searchTable">查询</el-button
              ><el-button icon="el-icon-download" :loading="exporting" @click="exportTable"
                >导出本收集单</el-button
              >
            </div>
            <el-table
              class="demand-list-desktop demand-table-compact"
              :data="rows"
              empty-text="暂无需求"
              @row-click="openDetail"
              ><el-table-column label="需求" min-width="150"
                ><template slot-scope="s"
                  ><div class="request-title" :title="s.row.title">
                    {{ s.row.title }}
                    <el-tag v-if="s.row.publicationPublished" type="success" size="mini">已公示</el-tag>
                    <el-tag v-else-if="s.row.publicationSkipped" type="info" size="mini">不公示</el-tag>
                    <el-tag v-else-if="s.row.decision !== 'REJECTED' && s.row.progress !== 'COMPLETED'" type="warning" size="mini">待公示</el-tag>
                  </div>
                  <small class="demand-muted request-meta" :title="tableMeta(s.row)">{{
                    tableMeta(s.row)
                  }}</small></template
                ></el-table-column
              ><el-table-column
                prop="submitterName"
                label="填报者"
                width="86"
                class-name="nowrap-cell" /><el-table-column
                prop="handlerName"
                label="经办人"
                width="86"
                class-name="nowrap-cell" /><el-table-column label="处理状态" min-width="120"
                ><template slot-scope="s"
                  >{{ decisions[s.row.decision] }} / {{ progresses[s.row.progress] }}</template
                ></el-table-column
              ><el-table-column label="提报时间" width="122"
                ><template slot-scope="s">{{ date(s.row.createTime) }}</template></el-table-column
              ><el-table-column label="操作" width="90"
                ><template slot-scope="s"
                  ><el-button type="text" @click.stop="openDetail(s.row)">分派 / 公示</el-button></template
                ></el-table-column
              ></el-table
            >
            <div class="demand-list-mobile">
              <article v-for="row in rows" :key="row.id" class="demand-card" @click="openDetail(row)">
                <h3>{{ row.title }}</h3>
                <small class="demand-muted">{{ tableMeta(row) }}</small>
                <p>{{ row.submitterName }} · {{ row.handlerName || '待分派' }}</p>
                <p class="demand-muted">提报 {{ date(row.createTime) }}</p>
                <div class="demand-card-footer">
                  <div class="demand-tags">
                    <el-tag size="small">{{ decisions[row.decision] }}</el-tag
                    ><el-tag v-if="row.publicationPublished" type="success" size="small">已公示</el-tag
                    ><el-tag v-else-if="row.publicationSkipped" type="info" size="small">不公示</el-tag
                    ><el-tag v-else type="warning" size="small">待公示</el-tag>
                  </div>
                  <el-button type="text" @click.stop="openDetail(row)">分派 / 公示</el-button>
                </div>
              </article>
              <el-empty v-if="!rows.length" description="暂无需求" />
            </div>
            <el-pagination
              :current-page.sync="page"
              :page-size="20"
              :total="total"
              layout="total, prev, pager, next"
              :pager-count="5"
              @current-change="loadTable"
            />
          </template></el-tab-pane
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
      <el-dialog title="全局回收站" :visible.sync="recycleVisible" :width="dialogWidth" append-to-body>
        <el-table v-loading="recycleLoading" :data="recycleRows" empty-text="回收站为空">
          <el-table-column label="收集单" min-width="180">
            <template slot-scope="s"
              ><div class="recycle-title">{{ plain(s.row.name) }}</div>
              <small class="demand-muted">删除于 {{ date(s.row.deletedAt) }}</small></template
            >
          </el-table-column>
          <el-table-column prop="demandCount" label="需求" width="70" />
          <el-table-column label="操作" width="150">
            <template slot-scope="s"
              ><el-button type="text" @click="restoreDeleted(s.row)">恢复</el-button
              ><el-button
                type="text"
                class="danger-text"
                :disabled="Number(s.row.demandCount) > 0 || Number(s.row.dataCount) > 0"
                @click="purgeDeleted(s.row)"
                >彻底删除</el-button
              ></template
            >
          </el-table-column>
        </el-table>
        <p class="demand-muted recycle-tip">已有需求或答卷的收集单不能彻底删除；请恢复后作废，或保留在回收站。</p>
      </el-dialog>
      <el-dialog
        title="导入部门目录"
        :visible.sync="departmentImportVisible"
        :width="dialogWidth"
        append-to-body
      >
        <p class="demand-muted">
          粘贴 JSON：departments 为部门清单，members 为用户部门关系。replace=true 时会停用未出现的部门并重建成员关系；成员可用 userId 或唯一姓名 userName。
        </p>
        <el-input
          v-model="departmentImportText"
          type="textarea"
          :rows="12"
          placeholder='{"replace":true,"departments":[{"key":"tech","name":"技术部","parentKey":null}],"members":[{"userId":910004,"deptKeys":["tech"]}]}'
        />
        <span slot="footer">
          <el-button @click="departmentImportVisible = false">取消</el-button>
          <el-button type="primary" :loading="departmentImportSaving" @click="importDepartmentTree">导入</el-button>
        </span>
      </el-dialog>
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
          <p class="demand-muted">
            填报、经办与管理权限分别授予，可同时拥有；「管理」即可管理/可公示。下表同时列出成员与部门授权，类型列区分，全选与一键保存对两类同时生效。成员与部门授权取并集，部门授权默认包含下级部门。创建人默认是单据管理员；单据管理员可在待我处理查看本收集单全部未办结需求，并分派、公示、跳过公示、代填处理结果。每个收集单至少保留一名有效单据管理员。
          </p>
          <div class="member-picker">
            <el-cascader
              v-model="departmentKey"
              :options="departmentOptions"
              :props="departmentProps"
              filterable
              clearable
              placeholder="选择部门（可含下级）"
              style="width: 100%"
            /><el-button @click="addDepartment">添加部门</el-button>
          </div>
          <div class="member-picker">
            <el-select
              v-model="memberId"
              filterable
              remote
              :remote-method="searchUsers"
              placeholder="搜索姓名选择人员"
              style="width: 100%"
              ><el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" /></el-select
            ><el-button @click="addMember">添加成员</el-button>
          </div>
          <div class="member-bulk-bar">
            <el-checkbox v-model="selectAllFill" :indeterminate="fillIndeterminate" :disabled="!grantRows.length"
              >全选可填报</el-checkbox
            ><el-checkbox v-model="selectAllHandle" :indeterminate="handleIndeterminate" :disabled="!grantRows.length"
              >全选可经办</el-checkbox
            ><el-checkbox v-model="selectAllManage" :indeterminate="manageIndeterminate" :disabled="!grantRows.length"
              >全选可管理</el-checkbox
            ><el-button type="primary" :loading="bulkSaving" :disabled="!grantRows.length" @click="saveAllGrants"
              >一键保存</el-button
            >
          </div>
          <el-table
            class="demand-table-compact member-grant-table"
            :data="grantRows"
            :row-key="grantRowKey"
            size="mini"
            border
            :max-height="grantTableMaxHeight"
            empty-text="暂无授权，请先添加成员或部门"
          >
            <el-table-column v-if="!mobile" label="类型" width="60" align="center">
              <template slot-scope="s">
                <el-tag size="mini" :type="s.row.rowType === 'department' ? 'success' : 'info'">{{
                  s.row.rowType === 'department' ? '部门' : '成员'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="名称" :min-width="mobile ? 90 : 140">
              <template slot-scope="s">
                <div class="member-grant-name" :title="grantLabel(s.row)">
                  <el-tag v-if="mobile" size="mini" :type="s.row.rowType === 'department' ? 'success' : 'info'">{{
                    s.row.rowType === 'department' ? '部门' : '成员'
                  }}</el-tag
                  ><span class="member-grant-name-text">{{ s.row.name }}</span
                  ><span v-if="s.row.rowType === 'department' && !mobile" class="demand-muted"
                    >（含下级 {{ Number(s.row.memberCount || 0) }} 人）</span
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column label="填报" :width="mobile ? 44 : 62" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canFill" :aria-label="s.row.name + '可填报'"
              /></template>
            </el-table-column>
            <el-table-column label="经办" :width="mobile ? 44 : 62" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canHandle" :aria-label="s.row.name + '可经办'"
              /></template>
            </el-table-column>
            <el-table-column label="管理" :width="mobile ? 44 : 62" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canManage" :aria-label="s.row.name + '可管理/可公示'"
              /></template>
            </el-table-column>
            <el-table-column label="操作" :width="mobile ? 60 : 104" align="center">
              <template slot-scope="s">
                <div class="member-grant-actions">
                  <el-button type="text" size="mini" :loading="saving" @click="saveGrantRow(s.row)">保存</el-button
                  ><el-button type="text" size="mini" class="danger-text" :loading="saving" @click="removeGrantRow(s.row)"
                    >移除</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="department-tools">
            <span class="demand-muted">部门授权默认包含下级部门；成员数按在职账户统计。</span>
            <el-button v-if="isGlobal" type="text" @click="openDepartmentImport">导入部门目录</el-button>
          </div></template
        ></el-drawer
      >
      <el-drawer title="后台管理员授权" :visible.sync="rolesVisible" :size="drawerWidth" custom-class="demand-detail-drawer"
        ><p class="demand-muted">后台管理员可进入后台并创建收集单；仅能看到本人创建或授予可管理的收集单，仍可按填报权限正常填报。</p>
        <div class="member-picker">
          <el-select
            v-model="roleUserId"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="选择人员"
            style="width: 100%"
            ><el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" /></el-select
          ><el-button type="primary" :loading="saving" @click="grantRole">授予后台管理</el-button>
        </div>
        <div v-for="role in roleRows" :key="role.userId" class="member-row">
          <strong>{{ role.name }}</strong
          ><el-button type="text" :loading="saving" @click="revokeRole(role)">撤销后台管理</el-button>
        </div>
        <p class="demand-muted">原系统超级管理员和配置项管理员拥有全局权限，不在此列表内，也不受本列表撤权影响。</p></el-drawer
      >
      <demand-detail ref="detail" @updated="afterTableUpdate" /></template
    ><el-result v-else icon="warning" title="无后台管理权限" sub-title="请使用具有管理权限的账户访问。" />
  </section>
</template>
<script>
import * as api from '@/api/demand'
import { createFormRequest } from '@/api/project/form'
import { refreshDemand, decisions, progresses } from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
import FormOverview from './components/FormOverview'
import exportMixin from './exportMixin'
export default {
  name: 'DemandAdmin',
  components: { DemandDetail, FormOverview },
  mixins: [exportMixin],
  data() {
    return {
      allowed: false,
      isGlobal: false,
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
      departmentKey: '',
      departmentRows: [],
      departmentList: [],
      departmentOptions: [],
      departmentProps: {
        value: 'deptKey',
        label: 'name',
        children: 'children',
        checkStrictly: true,
        emitPath: false
      },
      departmentImportVisible: false,
      departmentImportText: '',
      departmentImportSaving: false,
      rolesVisible: false,
      roleRows: [],
      roleUserId: '',
      recycleVisible: false,
      recycleRows: [],
      recycleLoading: false,
      createVisible: false,
      createForm: { name: '', description: '' },
      rows: [],
      page: 1,
      total: 0,
      tableKeyword: '',
      tableFormSummaries: [],
      tableFormKeyword: '',
      tableFormsLoading: false,
      selectedTableFormKey: '',
      selectedTableFormName: '',
      mobile: window.innerWidth < 768,
      viewportHeight: window.innerHeight,
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
    grantRows() {
      // 只拼接原对象引用，表格内的 v-model 才能直接改两套数组
      return [...this.departmentRows, ...this.memberRows]
    },
    grantTableMaxHeight() {
      return Math.max(240, this.viewportHeight - (this.mobile ? 470 : 440))
    },
    selectAllFill: {
      get() {
        return this.grantRows.length > 0 && this.grantRows.every((r) => r.canFill)
      },
      set(value) {
        this.grantRows.forEach((r) => {
          r.canFill = value
        })
      }
    },
    selectAllHandle: {
      get() {
        return this.grantRows.length > 0 && this.grantRows.every((r) => r.canHandle)
      },
      set(value) {
        this.grantRows.forEach((r) => {
          r.canHandle = value
        })
      }
    },
    fillIndeterminate() {
      return !this.selectAllFill && this.grantRows.some((r) => r.canFill)
    },
    handleIndeterminate() {
      return !this.selectAllHandle && this.grantRows.some((r) => r.canHandle)
    },
    selectAllManage: {
      get() {
        return this.grantRows.length > 0 && this.grantRows.every((r) => r.canManage)
      },
      set(value) {
        this.grantRows.forEach((r) => {
          r.canManage = value
        })
      }
    },
    manageIndeterminate() {
      return !this.selectAllManage && this.grantRows.some((r) => r.canManage)
    },
    hasManager() {
      return this.grantRows.some(
        (r) => r.canManage && (r.rowType === 'member' || Number(r.memberCount) > 0)
      )
    },
    filteredTableForms() {
      const keyword = this.tableFormKeyword.trim()
      if (!keyword) return this.tableFormSummaries
      return this.tableFormSummaries.filter((form) => this.plain(form.formName).includes(keyword))
    }
  },
  watch: {
    tab(v) {
      if (v === 'table') this.loadTableView()
    }
  },
  async created() {
    this.loading = true
    try {
      const permissions = await refreshDemand()
      this.allowed = permissions.admin
      this.isGlobal = permissions.global
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
      this.viewportHeight = window.innerHeight
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
    async toggleVoid(form) {
      const makeVoid = !form.voided
      const action = makeVoid ? '作废' : '恢复'
      try {
        await this.$confirm(
          makeVoid
            ? `作废后「${this.plain(form.name)}」将停止收集并从员工入口隐藏，已有需求保留，可在后台恢复。确认作废？`
            : `恢复后「${this.plain(form.name)}」将按原收集配置继续开放。确认恢复？`,
          `${action}收集单`,
          { type: 'warning', confirmButtonText: `确认${action}`, cancelButtonText: '取消' }
        )
      } catch (e) {
        return
      }
      this.saving = true
      try {
        await api.voidForm(form.formKey, { voided: makeVoid })
        this.$message.success(makeVoid ? '收集单已作废' : '收集单已恢复')
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async deleteCollection(form) {
      const demands = Number(form.demandCount || 0)
      try {
        await this.$confirm(
          demands > 0
            ? `「${this.plain(form.name)}」已有 ${demands} 条需求，删除后进入全局回收站，需求与答卷保留；建议先作废。确认删除？`
            : `确认将「${this.plain(form.name)}」删除到全局回收站？`,
          '删除收集单',
          { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
        )
      } catch (e) {
        return
      }
      this.saving = true
      try {
        const r = await api.deleteCollection(form.formKey)
        const count = Number((r.data && r.data.demandCount) || 0)
        this.$message.success(count > 0 ? '已移入回收站，需求与答卷已保留' : '已移入回收站')
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async openRecycle() {
      this.recycleVisible = true
      await this.loadRecycle()
    },
    async loadRecycle() {
      this.recycleLoading = true
      try {
        this.recycleRows = (await api.deletedForms()).data || []
      } finally {
        this.recycleLoading = false
      }
    },
    async restoreDeleted(row) {
      try {
        await this.$confirm(`确认恢复「${this.plain(row.name)}」？`, '恢复收集单', {
          type: 'warning',
          confirmButtonText: '确认恢复',
          cancelButtonText: '取消'
        })
      } catch (e) {
        return
      }
      this.saving = true
      try {
        await api.restoreCollection(row.formKey)
        this.$message.success('收集单已恢复')
        await this.loadRecycle()
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async purgeDeleted(row) {
      if (Number(row.demandCount) > 0 || Number(row.dataCount) > 0) return
      const name = this.plain(row.name)
      try {
        await this.$prompt(`彻底删除不可恢复。请输入收集单名称「${name}」确认。`, '彻底删除', {
          confirmButtonText: '确认删除',
          cancelButtonText: '取消',
          inputValidator: (value) => value === name || '名称不一致'
        })
      } catch (e) {
        return
      }
      this.saving = true
      try {
        await api.purgeCollection(row.formKey)
        this.$message.success('收集单已彻底删除')
        await this.loadRecycle()
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
      const [members, departments, departmentRows] = await Promise.all([
        api.members(form.formKey),
        api.departments(),
        api.departmentMembers(form.formKey)
      ])
      this.memberRows = (members.data || []).map((m) => ({ ...m, rowType: 'member' }))
      this.departmentList = departments.data || []
      this.departmentOptions = this.buildDepartmentTree(this.departmentList)
      this.departmentRows = (departmentRows.data || []).map((d) => ({
        ...d,
        rowType: 'department'
      }))
      this.departmentKey = ''
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
      this.memberRows.push({
        userId: user.id,
        name: user.name,
        rowType: 'member',
        canFill: false,
        canHandle: false,
        canManage: false
      })
    },
    grantRowKey(row) {
      return row.rowType === 'department' ? `department:${row.deptKey}` : `member:${row.userId}`
    },
    grantLabel(row) {
      return row.rowType === 'department'
        ? `${row.name}（含下级 ${Number(row.memberCount || 0)} 人）`
        : row.name
    },
    grantPayload(row) {
      return { canFill: !!row.canFill, canHandle: !!row.canHandle, canManage: !!row.canManage }
    },
    persistGrant(row) {
      const payload = this.grantPayload(row)
      return row.rowType === 'department'
        ? api.saveDepartmentMember(this.selected.formKey, row.deptKey, payload)
        : api.saveMember(this.selected.formKey, row.userId, payload)
    },
    async saveGrantRow(row) {
      if (!this.hasManager)
        return this.$message.warning('每个收集单至少保留一名有效单据管理员')
      this.saving = true
      try {
        await this.persistGrant(row)
        this.$message.success(row.rowType === 'department' ? '部门权限已保存' : '成员权限已保存')
        window.dispatchEvent(new Event('demand-updated'))
      } finally {
        this.saving = false
      }
    },
    async saveAllGrants() {
      if (!this.grantRows.length) return this.$message.warning('请先添加部门或成员')
      if (!this.hasManager)
        return this.$message.warning('每个收集单至少保留一名有效单据管理员')
      this.bulkSaving = true
      let saved = 0
      let failed = 0
      try {
        // 先授予新管理员，再撤销旧管理员，避免中间状态触发最后一名管理员校验。
        const ordered = [...this.grantRows].sort(
          (a, b) =>
            Number(!!b.canManage) - Number(!!a.canManage) ||
            (a.rowType === b.rowType ? 0 : a.rowType === 'department' ? -1 : 1)
        )
        for (const row of ordered) {
          try {
            await this.persistGrant(row)
            saved++
          } catch (e) {
            failed++
          }
        }
        if (failed) this.$message.warning(`已保存 ${saved} 项，${failed} 项保存失败，请重试`)
        else this.$message.success('成员与部门权限已保存')
        window.dispatchEvent(new Event('demand-updated'))
      } finally {
        this.bulkSaving = false
      }
    },
    async removeGrantRow(row) {
      const kind = row.rowType === 'department' ? '部门' : '成员'
      try {
        await this.$confirm(`确认移除${kind}「${row.name}」的授权？`, `移除${kind}授权`, {
          type: 'warning',
          confirmButtonText: '确认移除',
          cancelButtonText: '取消'
        })
      } catch (e) {
        return
      }
      this.saving = true
      try {
        if (row.rowType === 'department') {
          await api.removeDepartmentMember(this.selected.formKey, row.deptKey)
          this.departmentRows = this.departmentRows.filter((d) => d.deptKey !== row.deptKey)
        } else {
          await api.removeMember(this.selected.formKey, row.userId)
          this.memberRows = this.memberRows.filter((m) => m.userId !== row.userId)
        }
        this.$message.success(`${kind}授权已移除`)
        window.dispatchEvent(new Event('demand-updated'))
      } finally {
        this.saving = false
      }
    },
    addDepartment() {
      const department = this.departmentList.find((d) => d.deptKey === this.departmentKey)
      if (!department) return this.$message.warning('请选择部门')
      if (this.departmentRows.some((d) => d.deptKey === department.deptKey))
        return this.$message.info('该部门已在列表中')
      this.departmentRows.push({
        deptKey: department.deptKey,
        name: department.name,
        memberCount: department.memberCount,
        rowType: 'department',
        canFill: false,
        canHandle: false,
        canManage: false
      })
    },
    buildDepartmentTree(list) {
      const map = new Map()
      list.forEach((department) => map.set(department.deptKey, { ...department, children: [] }))
      const roots = []
      map.forEach((department) => {
        if (department.parentKey && map.has(department.parentKey))
          map.get(department.parentKey).children.push(department)
        else roots.push(department)
      })
      return roots
    },
    openDepartmentImport() {
      this.departmentImportText = ''
      this.departmentImportVisible = true
    },
    async importDepartmentTree() {
      let payload
      try {
        payload = JSON.parse(this.departmentImportText)
      } catch (e) {
        return this.$message.warning('JSON 格式无效')
      }
      this.departmentImportSaving = true
      try {
        const result = await api.importDepartments(payload)
        const data = result.data || {}
        this.$message.success(
          `已导入 ${data.departments || 0} 个部门、${data.memberships || 0} 条成员关系`
        )
        this.departmentImportVisible = false
        this.departmentImportText = ''
        if (this.selected) {
          const [departments, departmentRows] = await Promise.all([
            api.departments(),
            api.departmentMembers(this.selected.formKey)
          ])
          this.departmentList = departments.data || []
          this.departmentOptions = this.buildDepartmentTree(this.departmentList)
          this.departmentRows = (departmentRows.data || []).map((d) => ({
            ...d,
            rowType: 'department'
          }))
        }
      } finally {
        this.departmentImportSaving = false
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
        this.$message.success('后台管理权限已授予')
      } finally {
        this.saving = false
      }
    },
    async revokeRole(role) {
      await this.$confirm(`确认撤销 ${role.name} 的后台管理权限？`, '撤销后台管理', { type: 'warning' })
      this.saving = true
      try {
        await api.saveAdmin(role.userId, false)
        this.roleRows = (await api.admins()).data
      } finally {
        this.saving = false
      }
    },
    async loadTableView() {
      if (this.selectedTableFormKey) await this.loadTable()
      else await this.loadTableForms()
    },
    async loadTableForms() {
      this.tableFormsLoading = true
      try {
        this.tableFormSummaries = (await api.requestSummary({ scope: 'managed' })).data || []
      } catch (e) {
        this.tableFormSummaries = []
      } finally {
        this.tableFormsLoading = false
      }
    },
    selectTableForm(item) {
      this.selectedTableFormKey = item.formKey
      this.selectedTableFormName = this.plain(item.formName)
      this.tableKeyword = ''
      this.page = 1
      this.loadTable()
    },
    backToTableForms() {
      this.selectedTableFormKey = ''
      this.selectedTableFormName = ''
      this.tableKeyword = ''
      this.page = 1
      this.rows = []
      this.total = 0
      this.loadTableForms()
    },
    searchTable() {
      this.page = 1
      this.loadTable()
    },
    async loadTable() {
      if (!this.selectedTableFormKey) return
      try {
        const r = await api.listRequests({
          scope: 'managed',
          keyword: this.tableKeyword,
          formKey: this.selectedTableFormKey,
          page: this.page,
          size: 20
        })
        this.rows = r.data.rows
        this.total = r.data.total
      } catch (e) {
        /* 全局拦截器已提示错误，保留当前列表。 */
      }
    },
    exportTable() {
      return this.saveExport(
        () =>
          api.exportRequests({
            scope: 'managed',
            keyword: this.tableKeyword,
            formKey: this.selectedTableFormKey
          }),
        '需求总表'
      )
    },
    afterTableUpdate() {
      if (this.selectedTableFormKey) this.loadTable()
      else this.loadTableForms()
    },
    tableMeta(row) {
      return `${row.requestNo || ''} · ${this.plain(row.formName)}`
    },
    date(value) {
      return value ? String(value).replace('T', ' ').substring(0, 16) : ''
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
.admin-card-actions .danger-text {
  color: #f56c6c;
}
.danger-text {
  color: #f56c6c;
}
.recycle-title {
  overflow-wrap: anywhere;
}
.recycle-tip {
  margin: 12px 0 0;
}
.member-picker {
  display: flex;
  gap: 12px;
  margin: 12px 0;
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
.department-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  flex-wrap: wrap;
}
.member-row strong {
  flex: 1 1 180px;
  min-width: 0;
}
.member-grant-table {
  width: 100%;
  margin: 4px 0 8px;
}
.member-grant-name {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.member-grant-name-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.member-grant-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.member-grant-actions .el-button + .el-button {
  margin-left: 0;
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
  .member-grant-actions {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
