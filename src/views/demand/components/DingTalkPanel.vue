<template>
  <section class="dingtalk-panel" v-loading="loading">
    <article class="dingtalk-card dingtalk-config-card">
      <div class="dingtalk-card-head">
        <strong>应用配置</strong>
        <el-tag size="small" :type="status.configured && status.masterEnabled ? 'success' : 'info'">{{
          status.configured && status.masterEnabled ? '已启用' : '未完成'
        }}</el-tag>
      </div>
      <el-form label-position="top" class="dingtalk-config-form">
        <el-form-item label="AppKey（Client ID）">
          <el-input
            v-model="configForm.appKey"
            size="small"
            maxlength="100"
            placeholder="企业内部应用 AppKey"
          />
        </el-form-item>
        <el-form-item label="AppSecret">
          <el-input
            v-model="configForm.appSecret"
            size="small"
            type="password"
            show-password
            maxlength="200"
            :placeholder="config.secretConfigured ? '已配置，留空不修改' : '请输入 AppSecret'"
          />
        </el-form-item>
        <el-form-item label="AgentId">
          <el-input
            v-model="configForm.agentId"
            size="small"
            type="number"
            placeholder="例如 5165258519"
          />
        </el-form-item>
        <el-form-item label="链接基址">
          <el-input
            v-model="configForm.linkBase"
            size="small"
            placeholder="http://192.168.1.240:18000"
          />
        </el-form-item>
        <el-form-item label="部署总开关">
          <el-switch v-model="configForm.enabled" active-text="允许调用钉钉" />
        </el-form-item>
      </el-form>
      <div class="detail-actions">
        <el-button type="primary" size="small" :loading="configSaving" @click="saveConfig"
          >保存应用配置</el-button
        >
        <span class="demand-muted">密钥只写入服务器受控文件，接口不回显。</span>
      </div>
    </article>
    <div class="dingtalk-grid">
      <article class="dingtalk-card">
        <div class="dingtalk-card-head">
          <strong>应用状态</strong>
          <el-tag size="small" :type="status.enabled ? 'success' : 'info'">{{
            status.enabled ? '已启用' : '未启用'
          }}</el-tag>
        </div>
        <p class="demand-muted">
          部署总开关：{{ status.masterEnabled ? '已开启' : '未开启' }} · 凭证：{{
            status.configured ? '已配置' : '缺失'
          }} · 待办创建者：{{ status.creatorConfigured ? '已配置' : '缺失' }}
        </p>
        <p class="demand-muted">链接基址：{{ status.linkBase || '未配置' }}</p>
        <el-alert
          v-if="!status.masterEnabled || !status.configured"
          title="部署总开关未开启或应用凭证缺失，保存后也不会实际外呼。"
          type="warning"
          :closable="false"
        />
        <el-alert
          v-else-if="!status.creatorConfigured"
          title="未配置待办创建者 unionId，审批和待填报只会发工作通知、不建待办。"
          type="info"
          :closable="false"
        />
        <div class="detail-actions">
          <el-button size="small" :loading="testing" @click="testConnection">测试连接</el-button>
          <el-button size="small" :loading="testing" @click="sendTest">发送测试消息</el-button>
        </div>
      </article>
      <article class="dingtalk-card">
        <div class="dingtalk-card-head">
          <strong>人员映射</strong>
          <el-tag size="small" type="info">已确认 {{ mappingCounts.confirmed || 0 }}</el-tag>
        </div>
        <p class="demand-muted">
          钉钉用户 {{ mappingCounts.total || 0 }} · 待确认 {{ mappingCounts.PENDING_CONFIRM || 0 }} ·
          未匹配 {{ mappingCounts.UNMATCHED || 0 }} · 冲突 {{ mappingCounts.CONFLICT || 0 }}
        </p>
        <div class="detail-actions">
          <el-button size="small" :loading="syncing" @click="syncDirectory">同步钉钉通讯录</el-button>
          <el-button size="small" :disabled="!mappingCounts.PENDING_CONFIRM" @click="confirmMatched"
            >批量确认已匹配</el-button
          >
        </div>
        <p v-if="syncResult" class="demand-muted">
          最近同步：用户 {{ syncResult.users }}、部门 {{ syncResult.departments }}、待确认
          {{ syncResult.pendingConfirm }}、未匹配 {{ syncResult.unmatched }}、冲突
          {{ syncResult.conflict }}
        </p>
      </article>
    </div>

    <article class="dingtalk-card">
      <div class="dingtalk-card-head">
        <strong>推送设置</strong>
        <el-switch v-model="form.enabled" active-text="启用钉钉推送" />
      </div>
      <div class="event-grid">
        <div v-for="(label, kind) in eventLabels" :key="kind" class="event-row">
          <span>{{ label }}</span>
          <el-switch v-model="events[kind].work" active-text="工作通知" />
          <el-switch
            v-if="kind === 'APPROVAL' || kind === 'REQUIRED'"
            v-model="events[kind].todo"
            active-text="钉钉待办"
          />
        </div>
      </div>
      <div class="quiet-row">
        <span class="demand-muted">安静时段</span>
        <el-input v-model="form.quietStart" size="small" placeholder="20:00" style="width: 90px" />
        <span>至</span>
        <el-input v-model="form.quietEnd" size="small" placeholder="08:00" style="width: 90px" />
        <span class="demand-muted">审批默认绕过安静时段</span>
      </div>
      <div class="detail-actions">
        <el-button type="primary" size="small" :loading="saving" @click="saveSettings">保存设置</el-button>
      </div>
    </article>

    <el-tabs v-model="activeTab" class="dingtalk-tabs">
      <el-tab-pane label="映射列表" name="mapping">
        <div class="demand-toolbar">
          <el-select v-model="userState" size="small" clearable placeholder="全部状态" @change="loadUsers">
            <el-option label="待确认" value="PENDING_CONFIRM" />
            <el-option label="已确认" value="CONFIRMED" />
            <el-option label="未匹配" value="UNMATCHED" />
            <el-option label="冲突" value="CONFLICT" />
            <el-option label="已停用" value="INVALID" />
          </el-select>
          <el-input
            v-model="userKeyword"
            size="small"
            clearable
            placeholder="搜索钉钉姓名、邮箱或本地姓名"
            @keyup.enter.native="loadUsers"
          />
          <el-button size="small" @click="loadUsers">查询</el-button>
        </div>
        <div class="dingtalk-table-wrap">
          <el-table :data="users" size="small">
            <el-table-column prop="name" label="钉钉姓名" min-width="110" />
            <el-table-column prop="deptNames" label="部门" min-width="150" show-overflow-tooltip />
            <el-table-column prop="emailMasked" label="邮箱" width="150" />
            <el-table-column label="本地账户" min-width="120">
              <template slot-scope="s">{{ s.row.localName || '未绑定' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template slot-scope="s">
                <el-tag size="mini" :type="statusType(s.row.status)">{{
                  statusLabels[s.row.status] || s.row.status
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="230">
              <template slot-scope="s">
                <el-tag v-if="s.row.creator" size="mini" type="success">创建人</el-tag>
                <el-button
                  v-else-if="s.row.status === 'CONFIRMED' && s.row.unionId"
                  type="text"
                  size="mini"
                  @click="setCreator(s.row)"
                  >设为创建人</el-button
                >
                <el-button
                  v-if="s.row.status === 'PENDING_CONFIRM'"
                  type="text"
                  size="mini"
                  @click="confirmUser(s.row)"
                  >确认</el-button
                >
                <el-button
                  v-if="s.row.status !== 'CONFIRMED'"
                  type="text"
                  size="mini"
                  @click="openBind(s.row)"
                  >绑定</el-button
                >
                <el-button
                  v-else
                  type="text"
                  size="mini"
                  class="danger-text"
                  @click="unbindUser(s.row)"
                  >解绑</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-pagination
          :current-page.sync="userPage"
          :page-size="20"
          :total="userTotal"
          layout="total, prev, pager, next"
          :pager-count="5"
          @current-change="loadUsers"
        />
      </el-tab-pane>
      <el-tab-pane label="推送日志" name="pushes">
        <div class="demand-toolbar">
          <el-select v-model="pushStatus" size="small" clearable placeholder="全部状态" @change="loadPushes">
            <el-option label="待发送" value="PENDING" />
            <el-option label="已发送" value="SENT" />
            <el-option label="失败" value="FAILED" />
            <el-option label="已跳过" value="SKIPPED" />
            <el-option label="已终止" value="DEAD" />
          </el-select>
          <el-select v-model="pushChannel" size="small" clearable placeholder="全部渠道" @change="loadPushes">
            <el-option label="工作通知" value="WORK" />
            <el-option label="钉钉待办" value="TODO" />
          </el-select>
          <el-button size="small" @click="loadPushes">刷新</el-button>
        </div>
        <div class="dingtalk-table-wrap">
          <el-table :data="pushes" size="small">
            <el-table-column label="渠道" width="90">
              <template slot-scope="s">{{ s.row.channel === 'TODO' ? '待办' : '通知' }}</template>
            </el-table-column>
            <el-table-column label="动作" width="80">
              <template slot-scope="s">{{ actionLabels[s.row.action] || s.row.action }}</template>
            </el-table-column>
            <el-table-column prop="kind" label="事件" width="120" />
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template slot-scope="s">
                <el-tag size="mini" :type="statusType(s.row.status)">{{
                  pushStatusLabels[s.row.status] || s.row.status
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="attempts" label="尝试" width="60" />
            <el-table-column prop="lastError" label="错误" min-width="150" show-overflow-tooltip />
            <el-table-column label="操作" width="80">
              <template slot-scope="s">
                <el-button
                  v-if="['FAILED', 'DEAD', 'SKIPPED'].includes(s.row.status)"
                  type="text"
                  size="mini"
                  @click="retryPush(s.row)"
                  >重试</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-pagination
          :current-page.sync="pushPage"
          :page-size="20"
          :total="pushTotal"
          layout="total, prev, pager, next"
          :pager-count="5"
          @current-change="loadPushes"
        />
      </el-tab-pane>
    </el-tabs>

    <el-dialog title="绑定本地账户" :visible.sync="bindVisible" :width="dialogWidth" append-to-body>
      <p class="demand-muted">{{ bindRow.name }}（{{ bindRow.deptNames }}）</p>
      <el-input
        v-model="localKeyword"
        size="small"
        clearable
        placeholder="搜索本地姓名、邮箱或 ID"
        @keyup.enter.native="searchLocal"
      />
      <el-button size="small" @click="searchLocal">搜索</el-button>
      <el-table :data="localUsers" size="small" highlight-current-row @current-change="chooseLocal">
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="emailMasked" label="邮箱" />
        <el-table-column label="已绑定">
          <template slot-scope="s">{{ s.row.bound ? '是' : '否' }}</template>
        </el-table-column>
      </el-table>
      <span slot="footer"
        ><el-button @click="bindVisible = false">取消</el-button
        ><el-button type="primary" :disabled="!selectedLocal" @click="saveBind">确认绑定</el-button></span
      >
    </el-dialog>
  </section>
</template>
<script>
import * as api from '@/api/demand'

export default {
  name: 'DingTalkPanel',
  data() {
    return {
      loading: false,
      saving: false,
      syncing: false,
      testing: false,
      configSaving: false,
      status: {},
      config: {},
      configForm: { enabled: false, appKey: '', appSecret: '', agentId: '', linkBase: '' },
      mappingCounts: {},
      syncResult: null,
      form: { enabled: false, quietStart: '20:00', quietEnd: '08:00' },
      events: {
        APPROVAL: { work: true, todo: true },
        APPROVAL_RESULT: { work: true, todo: false },
        REQUIRED: { work: true, todo: true },
        REPLY: { work: true, todo: false },
        RESULT: { work: true, todo: false },
        ASSIGN: { work: false, todo: false },
        FOLLOWUP: { work: false, todo: false },
        NEW_DEMAND: { work: false, todo: false },
        PUBLICATION: { work: false, todo: false }
      },
      eventLabels: {
        APPROVAL: '待审批',
        APPROVAL_RESULT: '审批结果',
        REQUIRED: '待填报提醒',
        REPLY: '正式回复',
        RESULT: '处理结果',
        ASSIGN: '分派',
        FOLLOWUP: '追问',
        NEW_DEMAND: '新需求',
        PUBLICATION: '公示'
      },
      statusLabels: {
        PENDING_CONFIRM: '待确认',
        CONFIRMED: '已确认',
        UNMATCHED: '未匹配',
        CONFLICT: '冲突',
        INVALID: '已停用'
      },
      pushStatusLabels: {
        PENDING: '待发送',
        SENDING: '发送中',
        SENT: '已发送',
        FAILED: '失败',
        DEAD: '已终止',
        SKIPPED: '已跳过',
        CANCELLED: '已取消',
        DONE: '已完成'
      },
      actionLabels: { CREATE: '创建', COMPLETE: '完成', DELETE: '删除' },
      activeTab: 'mapping',
      userState: '',
      userKeyword: '',
      userPage: 1,
      userTotal: 0,
      users: [],
      pushStatus: '',
      pushChannel: '',
      pushPage: 1,
      pushTotal: 0,
      pushes: [],
      bindVisible: false,
      bindRow: {},
      localKeyword: '',
      localUsers: [],
      selectedLocal: null
    }
  },
  computed: {
    dialogWidth() {
      return window.innerWidth < 768 ? '94%' : '520px'
    }
  },
  mounted() {
    this.load()
    this.loadUsers()
    this.loadPushes()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const response = await api.dingtalkStatus()
        const data = response.data || {}
        this.status = data
        this.mappingCounts = data.mapping || {}
        this.form.enabled = !!data.requestedEnabled
        this.form.quietStart = (data.quiet && data.quiet.start) || '20:00'
        this.form.quietEnd = (data.quiet && data.quiet.end) || '08:00'
        const events = {}
        Object.keys(this.eventLabels).forEach((kind) => {
          const current = (data.events && data.events[kind]) || {}
          events[kind] = { work: !!current.work, todo: !!current.todo }
        })
        this.events = events
        const configResponse = await api.dingtalkConfig()
        const config = configResponse.data || {}
        this.config = config
        this.configForm = {
          enabled: !!config.enabled,
          appKey: config.appKey || '',
          appSecret: '',
          agentId: config.agentId ? String(config.agentId) : '',
          linkBase: config.linkBase || data.linkBase || window.location.origin
        }
      } finally {
        this.loading = false
      }
    },
    async saveConfig() {
      if (!this.configForm.appKey.trim()) {
        this.$message.warning('请填写 AppKey')
        return
      }
      if (!this.configForm.agentId || Number(this.configForm.agentId) <= 0) {
        this.$message.warning('请填写有效的 AgentId')
        return
      }
      if (!this.configForm.linkBase.trim()) {
        this.$message.warning('请填写链接基址')
        return
      }
      if (!this.configForm.appSecret && !this.config.secretConfigured) {
        this.$message.warning('请填写 AppSecret')
        return
      }
      this.configSaving = true
      try {
        const payload = {
          enabled: !!this.configForm.enabled,
          appKey: this.configForm.appKey.trim(),
          agentId: Number(this.configForm.agentId),
          linkBase: this.configForm.linkBase.trim()
        }
        if (this.configForm.appSecret) payload.appSecret = this.configForm.appSecret
        await api.saveDingtalkConfig(payload)
        this.$message.success('钉钉应用配置已保存')
        this.configForm.appSecret = ''
        await this.load()
      } finally {
        this.configSaving = false
      }
    },
    async saveSettings() {
      this.saving = true
      try {
        const payload = {
          enabled: this.form.enabled,
          'quiet.start': this.form.quietStart,
          'quiet.end': this.form.quietEnd
        }
        Object.keys(this.events).forEach((kind) => {
          payload['event.' + kind + '.work'] = !!this.events[kind].work
          payload['event.' + kind + '.todo'] = !!this.events[kind].todo
        })
        await api.saveDingtalkSettings(payload)
        this.$message.success('钉钉推送设置已保存')
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async syncDirectory() {
      this.syncing = true
      try {
        const response = await api.syncDingtalk()
        this.syncResult = response.data || {}
        this.$message.success('钉钉通讯录已同步')
        await this.load()
        await this.loadUsers()
      } finally {
        this.syncing = false
      }
    },
    async testConnection() {
      this.testing = true
      try {
        const response = await api.testDingtalkConnection()
        const data = response.data || {}
        this.$message.success(`连接成功，耗时 ${data.latencyMs || 0}ms`)
      } finally {
        this.testing = false
      }
    },
    async sendTest() {
      try {
        await this.$confirm('将向当前管理员本人的钉钉发送一条工作通知和待办，仅用于测试。', '测试发送', {
          type: 'warning'
        })
      } catch (error) {
        return
      }
      this.testing = true
      try {
        const response = await api.testDingtalk()
        const data = response.data || {}
        if (data.todoStatus === 'FAILED') {
          this.$message.warning(
            `工作通知已发送（${data.taskId || '已提交'}），但钉钉待办创建失败：${
              data.todoError || '未知错误'
            }`
          )
        } else if (data.todoStatus === 'SKIPPED') {
          this.$message.warning(
            `工作通知已发送（${data.taskId || '已提交'}）；待办未创建：${data.todoError || '未配置'}`
          )
        } else {
          this.$message.success(
            `已发送：工作通知 ${data.taskId || '已提交'}${
              data.todoTaskId ? '，待办 ' + data.todoTaskId : ''
            }`
          )
        }
        await this.loadPushes()
      } finally {
        this.testing = false
      }
    },
    async loadUsers() {
      const response = await api.dingtalkUsers({
        state: this.userState,
        keyword: this.userKeyword,
        page: this.userPage,
        size: 20
      })
      const data = response.data || {}
      this.users = data.rows || []
      this.userTotal = data.total || 0
      this.mappingCounts = data.counts || this.mappingCounts
    },
    statusType(status) {
      if (status === 'CONFIRMED' || status === 'SENT' || status === 'DONE') return 'success'
      if (status === 'PENDING_CONFIRM' || status === 'PENDING' || status === 'SENDING') return 'warning'
      if (status === 'CONFLICT' || status === 'FAILED' || status === 'DEAD') return 'danger'
      return 'info'
    },
    async setCreator(row) {
      try {
        await this.$confirm(
          `将 ${row.name} 设为钉钉待办的创建人？审批和待填报待办将以该账号名义创建。`,
          '设置待办创建人',
          { type: 'warning' }
        )
      } catch (error) {
        return
      }
      await api.setDingtalkCreator(row.dingtalkUserId)
      this.$message.success('待办创建人已更新')
      await this.load()
      await this.loadUsers()
    },
    async confirmUser(row) {
      await api.confirmDingtalkUser(row.dingtalkUserId)
      this.$message.success('已确认钉钉映射')
      await this.loadUsers()
      await this.load()
    },
    async confirmMatched() {
      try {
        await this.$confirm('批量确认所有邮箱精确匹配的钉钉账户？确认后才会参与推送。', '批量确认', {
          type: 'warning'
        })
      } catch (error) {
        return
      }
      const response = await api.confirmMatchedDingtalk()
      this.$message.success(`已确认 ${response.data || 0} 条映射`)
      await this.loadUsers()
      await this.load()
    },
    async unbindUser(row) {
      try {
        await this.$confirm(`确认解绑 ${row.name} 的本地账户？`, '解绑', { type: 'warning' })
      } catch (error) {
        return
      }
      await api.unbindDingtalkUser(row.dingtalkUserId)
      this.$message.success('已解绑')
      await this.loadUsers()
      await this.load()
    },
    openBind(row) {
      this.bindRow = row
      this.selectedLocal = null
      this.localKeyword = ''
      this.localUsers = []
      this.bindVisible = true
      this.searchLocal()
    },
    async searchLocal() {
      const response = await api.dingtalkLocalUsers(this.localKeyword)
      this.localUsers = (response.data && response.data.rows) || []
    },
    chooseLocal(row) {
      this.selectedLocal = row
    },
    async saveBind() {
      if (!this.selectedLocal) return
      await api.bindDingtalkUser(this.bindRow.dingtalkUserId, {
        userId: this.selectedLocal.userId
      })
      this.$message.success('已绑定钉钉账户')
      this.bindVisible = false
      await this.loadUsers()
      await this.load()
    },
    async loadPushes() {
      const response = await api.dingtalkPushes({
        status: this.pushStatus,
        channel: this.pushChannel,
        page: this.pushPage,
        size: 20
      })
      const data = response.data || {}
      this.pushes = data.rows || []
      this.pushTotal = data.total || 0
    },
    async retryPush(row) {
      await api.retryDingtalkPush(row.id)
      this.$message.success('已加入重试队列')
      await this.loadPushes()
    }
  }
}
</script>
<style scoped>
.dingtalk-panel {
  display: grid;
  gap: 16px;
}
.dingtalk-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.dingtalk-card {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}
.dingtalk-config-card {
  grid-column: 1 / -1;
}
.dingtalk-config-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.dingtalk-config-form .el-form-item {
  margin-bottom: 12px;
}
.dingtalk-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.event-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 14px 0;
}
.event-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.quiet-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.dingtalk-table-wrap {
  overflow-x: auto;
}
.dingtalk-tabs {
  padding: 0 16px 16px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}
@media (max-width: 1023px) {
  .dingtalk-grid,
  .event-grid,
  .dingtalk-config-form {
    grid-template-columns: 1fr;
  }
  .dingtalk-panel {
    gap: 12px;
  }
}
</style>
