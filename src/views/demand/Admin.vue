<template>
  <section class="demand-page" v-loading="loading">
    <template v-if="allowed"
      ><div class="demand-title-row">
        <div>
          <h1>{{ mode === 'admin' ? '后台管理' : '单据管理' }}</h1>
          <p class="demand-subtitle">
            {{
              mode === 'admin'
                ? '全局管理员查看全部收集单与需求总表，并维护平台权限；用户管理在侧栏单独进入。'
                : '管理本人创建或获授权的收集单：处理需求、维护成员与配置。新建与设计发布需平台“单据管理”能力。'
            }}
          </p>
        </div>
        <div class="admin-actions">
          <el-button v-if="isGlobal && mode === 'admin'" @click="openRecycle">全局回收站</el-button
          ><el-button v-if="isGlobal && mode === 'admin'" @click="openRoles">{{
            permissionApi ? '平台权限授权' : '后台管理员授权'
          }}</el-button
          ><el-button v-if="canCreate" type="primary" icon="el-icon-plus" @click="createVisible = true"
            >新建收集单</el-button
          >
        </div>
      </div>
      <el-tabs v-model="tab"
        ><el-tab-pane v-if="canDocument" label="收集单管理" name="forms"
          ><div class="demand-toolbar">
            <div class="demand-pill-group" role="group" aria-label="按状态筛选收集单">
              <button
                v-for="item in statusOptions"
                :key="item.value"
                type="button"
                class="demand-pill"
                :class="{ 'is-active': statusFilter === item.value }"
                @click="statusFilter = item.value"
              >
                <span class="demand-pill-dot" :style="{ backgroundColor: item.color }" />{{ item.label }}
              </button>
            </div>
            <div class="demand-toolbar-end">
              <el-input v-model="keyword" placeholder="搜索收集单" clearable prefix-icon="el-icon-search" />
              <el-button v-if="isGlobal && mode === 'admin'" @click="$router.push('/project/my')">原表单后台</el-button>
            </div>
          </div>
          <div class="admin-form-list demand-card-grid">
            <article
              v-for="form in filtered"
              :key="form.formKey"
              class="demand-card demand-card-full"
              :class="{ 'is-voided': form.voided }"
            >
              <demand-card-cover label="需求收集" />
              <div class="demand-card-body">
                <div class="demand-card-title-row">
                  <h3
                    class="demand-card-title"
                    :class="{ 'is-clickable': canCreate }"
                    :title="plain(form.name)"
                    @click="canCreate && editOriginal(form)"
                  >
                    {{ plain(form.name) }}
                  </h3>
                </div>
                <p class="demand-card-desc" :title="form.summary || plain(form.description)">
                  {{ form.summary || plain(form.description) || '尚未配置需求收集说明' }}
                </p>
                <div class="demand-card-meta">
                  <span class="demand-card-status" :class="formStatus(form).className">
                    <span class="demand-card-status-dot" aria-hidden="true" />
                    <span>{{ formStatus(form).text }}</span>
                  </span>
                  <span class="demand-card-meta-end">
                    <span class="demand-card-count">{{
                      Number(form.demandCount) > 0 ? form.demandCount + ' 条需求' : '暂无需求'
                    }}</span>
                  </span>
                </div>
                <div class="demand-tags demand-card-tags">
                  <el-tag v-if="form.voided" size="small" type="danger">已作废</el-tag>
                  <el-tag v-if="form.collectOnly" size="small" type="info">只收集</el-tag>
                  <el-tag v-if="form.visibility === 'SELECTED'" size="small" type="warning">指定人员</el-tag>
                  <el-tag v-if="form.allowAnonymous" size="small" type="info">可匿名</el-tag>
                </div>
              </div>
              <div class="demand-card-actions">
                <div class="demand-card-actions-main">
                  <el-button v-if="canCreate" size="mini" class="demand-card-action is-primary" @click="editOriginal(form)"
                    >设计与发布</el-button
                  ><el-button v-if="form.canManage" size="mini" class="demand-card-action is-secondary" @click="openConfig(form)"
                    >收集配置</el-button
                  ><el-button v-if="form.canManage" size="mini" class="demand-card-action is-secondary" @click="openMembers(form)"
                    >成员权限</el-button
                  >
                </div>
                <el-dropdown
                  v-if="form.canManage"
                  class="demand-card-more"
                  trigger="click"
                  placement="bottom-end"
                  @command="handleCardCommand($event, form)"
                >
                  <button type="button" class="demand-card-more-trigger" aria-label="更多操作">
                    <i class="el-icon-more" aria-hidden="true" />
                  </button>
                  <el-dropdown-menu slot="dropdown" class="demand-card-more-menu" role="menu">
                    <el-dropdown-item
                      v-if="form.visibility"
                      :command="form.voided ? 'restore' : 'void'"
                      role="menuitem"
                      :class="form.voided ? '' : 'is-warning'"
                      >{{ form.voided ? '恢复' : '作废' }}</el-dropdown-item
                    >
                    <el-dropdown-item command="delete" role="menuitem" class="is-danger" divided
                      >删除</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </el-dropdown>
              </div>
            </article>
          </div>
          <el-empty v-if="!filtered.length" description="暂无收集单，请先新建" /></el-tab-pane
        ><el-tab-pane v-if="canDocument" label="需求总表与公示审核" name="table"
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
              ><el-table-column label="需求" :width="roomy ? 360 : null" min-width="150"
                ><template slot-scope="s"
                  ><div class="request-title" :title="s.row.title">
                    {{ s.row.title }}
                    <el-tag v-if="s.row.collectOnly && s.row.unread" type="danger" size="mini">未读</el-tag>
                    <template v-if="s.row.collectOnly">
                      <el-tag type="info" size="mini">只收集</el-tag>
                    </template>
                    <template v-else>
                      <el-tag v-if="s.row.publicationPublished" type="success" size="mini">已公示</el-tag>
                      <el-tag v-else-if="s.row.publicationArchived" type="info" size="mini">已归档</el-tag>
                      <el-tag v-else-if="s.row.publicationSkipped" type="info" size="mini">不公示</el-tag>
                      <el-tag v-else-if="s.row.decision !== 'REJECTED' && s.row.progress !== 'COMPLETED'" type="warning" size="mini">待公示</el-tag>
                      <el-tag v-if="s.row.followupPending" type="warning" size="mini">追问</el-tag>
                    </template>
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
                class-name="nowrap-cell" /><el-table-column label="处理状态" width="110"
                ><template slot-scope="s"
                  >{{ s.row.collectOnly ? '只收集' : decisions[s.row.decision] + ' / ' + progresses[s.row.progress] }}</template
                ></el-table-column
              ><el-table-column label="提报时间" width="122"
                ><template slot-scope="s">{{ date(s.row.createTime) }}</template></el-table-column
              ><el-table-column label="操作" width="140"
                ><template slot-scope="s"
                  ><el-button type="text" @click.stop="openDetail(s.row)">{{ s.row.collectOnly ? '查看' : '分派 / 公示' }}</el-button
                  ><el-button
                    v-if="s.row.canManage"
                    type="text"
                    class="danger-text"
                    @click.stop="deleteDemand(s.row)"
                    >删除</el-button
                  ></template
                ></el-table-column
              ><el-table-column v-if="roomy" />
              </el-table
            >
            <div class="demand-list-mobile">
              <article
                v-for="row in rows"
                :key="row.id"
                class="demand-card demand-card-compact demand-card-clickable"
                @click="openDetail(row)"
              >
                <div class="demand-card-body">
                  <div class="demand-card-title-row">
                    <h3 class="demand-card-title">{{ row.title }}</h3>
                  </div>
                  <p class="demand-card-kicker">{{ tableMeta(row) }}</p>
                  <p class="demand-card-line">{{ row.submitterName }} · {{ row.handlerName || '待分派' }}</p>
                  <p class="demand-card-time">提报 {{ date(row.createTime) }}</p>
                  <div class="demand-tags demand-card-tags">
                    <template v-if="row.collectOnly">
                      <el-tag v-if="row.unread" size="small" type="danger">未读</el-tag>
                      <el-tag size="small" type="info">只收集</el-tag>
                    </template>
                    <template v-else>
                      <el-tag size="small">{{ decisions[row.decision] }}</el-tag
                      ><el-tag v-if="row.publicationPublished" type="success" size="small">已公示</el-tag
                      ><el-tag v-else-if="row.publicationArchived" type="info" size="small">已归档</el-tag
                      ><el-tag v-else-if="row.publicationSkipped" type="info" size="small">不公示</el-tag
                      ><el-tag v-else type="warning" size="small">待公示</el-tag
                      ><el-tag v-if="row.followupPending" type="warning" size="small">追问</el-tag>
                    </template>
                  </div>
                </div>
                <div class="demand-card-actions">
                  <div class="demand-card-actions-main">
                    <el-button
                      size="mini"
                      class="demand-card-action is-primary"
                      @click.stop="openDetail(row)"
                      >{{ row.collectOnly ? '查看' : '分派 / 公示' }}</el-button
                    >
                    <el-button
                      v-if="row.canManage"
                      size="mini"
                      type="text"
                      class="danger-text"
                      @click.stop="deleteDemand(row)"
                      >删除</el-button
                    >
                  </div>
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
          <el-table-column label="收集单" :min-width="mobile ? 120 : 180">
            <template slot-scope="s"
              ><div class="recycle-title">{{ plain(s.row.name) }}</div>
              <small class="demand-muted"
                >删除于 {{ date(s.row.deletedAt)
                }}<template v-if="mobile"> · 需求 {{ s.row.demandCount }} / 答卷 {{ s.row.dataCount }}</template></small
              ></template
            >
          </el-table-column>
          <el-table-column v-if="!mobile" prop="demandCount" label="需求" width="70" />
          <el-table-column label="操作" :width="mobile ? 122 : 150">
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
          ><el-form-item label="只收集"
            ><el-switch v-model="config.collectOnly" />
            <p class="demand-muted">只收集信息，不进入回复、采纳和公示；未读时进入待我处理，已读后移出。</p></el-form-item
          ><el-form-item label="允许匿名填写"
            ><el-switch
              v-model="config.allowAnonymous"
              :disabled="config.visibility === 'SELECTED' || config.requiresLeaderApproval" />
            <p class="demand-muted">默认登录填写；指定人员收集单不能开放匿名。</p></el-form-item
          ><el-form-item label="部门主管审批"
            ><el-switch v-model="config.requiresLeaderApproval" @change="leaderApprovalChanged" />
            <p class="demand-muted">
              开启后提交先到填报人部门主管审批，通过后进入单据处理；需先在用户管理页配置部门主管，匿名将自动关闭。
            </p></el-form-item
          ><el-form-item label="截止时间"
            ><el-date-picker
              v-model="config.endTime"
              type="datetime"
              value-format="yyyy-MM-dd HH:mm:ss"
              placeholder="不设置则长期有效"
              style="width: 100%" /></el-form-item
          ><el-form-item label="轮次模式"
            ><el-radio-group v-model="config.roundMode"
              ><el-radio label="NONE">不启用</el-radio
              ><el-radio label="SINGLE">单轮</el-radio
              ><el-radio label="PERIODIC">周期</el-radio></el-radio-group
            >
            <p class="demand-muted">启用后可设置必填人；周期模式到期自动开下一轮。</p></el-form-item
          ><el-form-item v-if="config.roundMode === 'PERIODIC'" label="轮次周期"
            ><el-radio-group v-model="config.roundPeriod"
              ><el-radio label="MONTH">每月</el-radio
              ><el-radio label="QUARTER">每季</el-radio></el-radio-group
            ></el-form-item
          ><el-form-item v-if="config.roundMode !== 'NONE'" label="本轮截止期限"
            ><el-date-picker
              v-model="config.roundEndTime"
              type="datetime"
              value-format="yyyy-MM-dd HH:mm:ss"
              placeholder="单轮必填；周期可留空按周期推算"
              style="width: 100%" /></el-form-item
          ><el-form-item v-if="config.roundMode !== 'NONE'" label="提醒方式"
            ><el-radio-group v-model="config.reminderMode"
              ><el-radio label="DEFAULT">截止前提醒</el-radio
              ><el-radio label="STRONG">每日提醒</el-radio></el-radio-group
            ></el-form-item
          ><el-form-item v-if="config.roundMode !== 'NONE'" label="必填人"
            ><el-button size="small" @click="openRequired">设置必填人与查看名单</el-button>
            <p class="demand-muted">必填人须在本轮内提交；匿名提交不计入完成。请先保存轮次配置。</p></el-form-item
          ><el-form-item label="向首页开放"
            ><el-switch v-model="config.published" />
            <p class="demand-muted">须同时在原表单设计器的“发布”页发布，才会进入员工可见列表。</p></el-form-item
          ><el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button></el-form
        ></el-drawer
      >
      <el-drawer
        title="必填人设置"
        :visible.sync="requiredVisible"
        :size="drawerWidth"
        custom-class="demand-detail-drawer"
        ><template v-if="selected"
          ><h3>{{ plain(selected.name) }}</h3>
          <p class="demand-muted">
            轮次：{{ roundModeText }}；本轮截止：{{ requiredEndText }}；提醒：{{
              requiredData && requiredData.reminderMode === 'STRONG' ? '每日提醒' : '截止前提醒'
            }}。调整轮次请先在「收集配置」保存。
          </p>
          <div class="member-combo">
            <el-popover
              ref="requiredPopover"
              v-model="requiredComboVisible"
              trigger="manual"
              placement="bottom-start"
              :width="requiredPanelWidth"
              :visible-arrow="false"
              popper-class="member-tree-popper"
              @show="syncRequiredPanelWidth"
            >
              <div class="member-tree-panel" @keydown.esc.stop="requiredComboVisible = false">
                <el-tree
                  ref="requiredTree"
                  class="member-tree"
                  :data="comboTree"
                  node-key="id"
                  default-expand-all
                  :indent="mobile ? 12 : 18"
                  :filter-node-method="filterComboNode"
                  empty-text="暂无部门或成员"
                >
                  <template slot-scope="{ data }"
                    ><div class="member-tree-row" :class="['is-' + data.type]">
                      <template v-if="data.type !== 'group'">
                        <el-tag size="mini" :type="data.type === 'department' ? 'success' : 'info'">{{
                          data.type === 'department' ? '部门' : '成员'
                        }}</el-tag>
                        <span class="member-tree-name" :title="comboNodeTitle(data)">{{ data.name }}</span>
                        <span class="member-tree-hint">{{ requiredNodeHint(data) }}</span>
                        <button
                          type="button"
                          class="member-tree-circle"
                          :class="{ 'is-added': isRequiredAdded(data) }"
                          :disabled="isRequiredAdded(data)"
                          :aria-label="'添加' + data.name"
                          @click.stop="addRequiredNode(data)"
                        >
                          <i v-if="isRequiredAdded(data)" class="el-icon-check" />
                        </button>
                      </template>
                      <template v-else>
                        <span class="member-tree-name">{{ data.name }}</span>
                        <span class="member-tree-hint">{{ data.children.length }} 人</span>
                      </template>
                    </div></template
                  >
                </el-tree>
              </div>
              <el-input
                slot="reference"
                ref="requiredInput"
                v-model="requiredComboText"
                clearable
                prefix-icon="el-icon-search"
                placeholder="搜索部门或成员，点击圆圈添加"
                @focus="openRequiredCombo"
                @click.native="openRequiredCombo"
                @keydown.esc.native.stop="requiredComboVisible = false"
              />
            </el-popover>
            <p class="demand-muted member-combo-tip">部门默认包含下级部门；指定人员收集单会自动补填报权限。</p>
          </div>
          <el-checkbox v-model="requiredRequireMembers" class="required-members-toggle"
            >收集单可填报成员全部计入必填人</el-checkbox
          >
          <el-table
            class="demand-table-compact member-grant-table required-subject-table"
            :data="requiredSubjects"
            row-key="rowKey"
            size="mini"
            max-height="200"
          >
            <el-table-column label="类型" width="70"
              ><template slot-scope="s">{{ s.row.type === 'DEPT' ? '部门' : '成员' }}</template></el-table-column
            >
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column label="" width="60"
              ><template slot-scope="s"
                ><el-button type="text" @click="removeRequiredSubject(s.row)">移除</el-button></template
              ></el-table-column
            >
          </el-table>
          <p v-if="requiredData" class="required-summary">
            必填 {{ (requiredData.members || []).length }} 人 · 已提交
            {{ (requiredData.stats || {}).submitted || 0 }} · 未提交
            {{ (requiredData.stats || {}).pending || 0 }} · 匿名提交
            {{ (requiredData.stats || {}).anonymous || 0 }}
          </p>
          <el-button type="primary" :loading="requiredSaving" @click="saveRequired">保存必填人</el-button>
          <h4 class="required-list-title">本轮名单</h4>
          <el-table
            v-loading="requiredLoading"
            class="demand-table-compact required-member-table"
            :data="(requiredData && requiredData.members) || []"
            size="mini"
            max-height="320"
          >
            <el-table-column prop="name" label="姓名" width="90" />
            <el-table-column prop="departments" label="部门" min-width="110" show-overflow-tooltip />
            <el-table-column label="来源" width="130"
              ><template slot-scope="s">{{ sourceText(s.row.sources) }}</template></el-table-column
            >
            <el-table-column label="状态" width="80"
              ><template slot-scope="s"
                ><el-tag size="mini" :type="s.row.submitted ? 'success' : 'danger'">{{
                  s.row.submitted ? '已提交' : '未提交'
                }}</el-tag></template
              ></el-table-column
            >
          </el-table>
        </template></el-drawer
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
          <div class="member-combo">
            <el-popover
              ref="memberPopover"
              v-model="comboVisible"
              trigger="manual"
              placement="bottom-start"
              :width="comboPanelWidth"
              :visible-arrow="false"
              popper-class="member-tree-popper"
              @show="syncComboPanelWidth"
            >
              <div class="member-tree-panel" @keydown.esc.stop="closeCombo">
                <el-tree
                  ref="memberTree"
                  class="member-tree"
                  :data="comboTree"
                  node-key="id"
                  default-expand-all
                  :indent="mobile ? 12 : 18"
                  :filter-node-method="filterComboNode"
                  empty-text="暂无部门或成员"
                >
                  <template slot-scope="{ data }"
                    ><div class="member-tree-row" :class="['is-' + data.type, { 'is-added': isComboAdded(data) }]">
                      <template v-if="data.type !== 'group'">
                        <el-tag size="mini" :type="data.type === 'department' ? 'success' : 'info'">{{
                          data.type === 'department' ? '部门' : '成员'
                        }}</el-tag>
                        <span class="member-tree-name" :title="comboNodeTitle(data)">{{ data.name }}</span>
                        <span class="member-tree-hint">{{ comboNodeHint(data) }}</span>
                        <button
                          type="button"
                          class="member-tree-circle"
                          :class="{ 'is-added': isComboAdded(data) }"
                          :disabled="isComboAdded(data)"
                          :aria-label="comboCircleLabel(data)"
                          @click.stop="addComboNode(data)"
                        >
                          <i v-if="isComboAdded(data)" class="el-icon-check" />
                        </button>
                      </template>
                      <template v-else>
                        <span class="member-tree-name">{{ data.name }}</span>
                        <span class="member-tree-hint">{{ comboNodeHint(data) }}</span>
                      </template>
                    </div></template
                  >
                </el-tree>
              </div>
              <el-input
                slot="reference"
                ref="comboInput"
                v-model="comboText"
                clearable
                prefix-icon="el-icon-search"
                placeholder="搜索部门或成员，点击圆圈添加"
                @focus="openCombo"
                @click.native="openCombo"
                @keydown.esc.native.stop="closeCombo"
              />
            </el-popover>
            <p class="demand-muted member-combo-tip">点击部门行展开或收起，点击圆圈加入下表；部门授权默认包含下级部门。</p>
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
            <el-table-column v-if="!mobile" label="类型" width="56" align="center">
              <template slot-scope="s">
                <el-tag size="mini" :type="s.row.rowType === 'department' ? 'success' : 'info'">{{
                  s.row.rowType === 'department' ? '部门' : '成员'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="名称" :min-width="mobile ? 90 : 170">
              <template slot-scope="s">
                <div class="member-grant-name" :title="grantLabel(s.row)">
                  <el-tag v-if="mobile" size="mini" :type="s.row.rowType === 'department' ? 'success' : 'info'">{{
                    s.row.rowType === 'department' ? '部门' : '成员'
                  }}</el-tag
                  ><span class="member-grant-name-text">{{ s.row.name }}</span
                  ><span v-if="s.row.rowType === 'department' && !mobile" class="demand-muted member-grant-count"
                    >（含下级 {{ Number(s.row.memberCount || 0) }} 人）</span
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column label="填报" :width="mobile ? 44 : 58" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canFill" :aria-label="s.row.name + '可填报'"
              /></template>
            </el-table-column>
            <el-table-column label="经办" :width="mobile ? 44 : 58" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canHandle" :aria-label="s.row.name + '可经办'"
              /></template>
            </el-table-column>
            <el-table-column label="管理" :width="mobile ? 44 : 58" align="center">
              <template slot-scope="s"
                ><el-checkbox v-model="s.row.canManage" :aria-label="s.row.name + '可管理/可公示'"
              /></template>
            </el-table-column>
            <el-table-column label="操作" :width="mobile ? 60 : 100" align="center">
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
      <el-drawer
        :title="permissionApi ? '平台权限授权' : '后台管理员授权'"
        :visible.sync="rolesVisible"
        :size="drawerWidth"
        custom-class="demand-detail-drawer"
        ><template v-if="permissionApi">
          <p class="demand-muted">
            平台权限可独立授予：单据管理含新建收集单、设计发布与 AI 协作；用户管理（组织架构）维护部门、成员与部门主管。单据级「管理」只能管理本单，不能建单；原用户管理页已隐藏。后台管理仅全局管理员可见。
          </p>
          <div class="member-picker">
            <el-select
              v-model="roleUserId"
              filterable
              remote
              :remote-method="searchUsers"
              placeholder="选择人员"
              style="width: 100%"
              ><el-option v-for="user in candidates" :key="user.id" :label="user.name" :value="user.id" /></el-select
            ><el-button type="primary" :loading="saving" @click="addPermissionUser">添加人员</el-button>
          </div>
          <div class="permission-matrix">
            <div class="permission-matrix-head" :style="permissionGridStyle">
              <span>人员</span
              ><span v-for="definition in permissionDefinitions" :key="definition.key" :title="definition.description">{{
                definition.name
              }}</span
              ><span>操作</span>
            </div>
            <div v-for="row in permissionRows" :key="row.userId" class="permission-matrix-row" :style="permissionGridStyle">
              <strong :title="row.name">{{ row.name }}</strong
              ><span v-for="definition in permissionDefinitions" :key="definition.key" class="permission-cell">
                <el-checkbox
                  v-model="row.capabilities"
                  :label="definition.key"
                  :aria-label="definition.name"
                  :title="definition.description"
                />
              </span>
              <span class="permission-actions"
                ><el-button type="text" size="mini" :loading="saving" @click="savePermissionRow(row)">保存</el-button
                ><el-button type="text" size="mini" class="danger-text" :loading="saving" @click="revokePermissionRow(row)"
                  >撤销</el-button
                ></span
              >
            </div>
            <el-empty v-if="!permissionRows.length" :image-size="60" description="暂无授权用户" />
          </div>
          <div class="permission-global-only">
            <p class="demand-muted">全局管理员专属：</p>
            <el-tag v-for="item in globalOnly" :key="item.key" size="small" type="info" :title="item.description">{{
              item.name
            }}</el-tag>
          </div>
          <p class="demand-muted">原系统超级管理员和配置项管理员拥有全局权限，不在此列表内。</p></template
        ><template v-else
          ><p class="demand-muted">
            后台管理员可进入后台并创建收集单；仅能看到本人创建或授予可管理的收集单，仍可按填报权限正常填报。
          </p>
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
          <p class="demand-muted">原系统超级管理员和配置项管理员拥有全局权限，不在此列表内，也不受本列表撤权影响。</p></template
        ></el-drawer
      >
      <demand-detail ref="detail" @read="readTableRow" @updated="afterTableUpdate" /></template
    ><el-result v-else icon="warning" title="无后台管理权限" sub-title="请使用具有管理权限的账户访问。" />
  </section>
</template>
<script>
import * as api from '@/api/demand'
import { createFormRequest } from '@/api/project/form'
import { refreshDemand, decisions, progresses } from '@/utils/demand'
import DemandDetail from './components/DemandDetail'
import DemandCardCover from './components/DemandCardCover'
import FormOverview from './components/FormOverview'
import exportMixin from './exportMixin'
export default {
  name: 'DemandAdmin',
  props: {
    mode: { type: String, default: 'admin' }
  },
  components: { DemandDetail, DemandCardCover, FormOverview },
  mixins: [exportMixin],
  data() {
    return {
      allowed: false,
      isGlobal: false,
      canCreate: false,
      canDocument: false,
      permissionApi: false,
      permissionDefinitions: [],
      globalOnly: [],
      permissionRows: [],
      loading: false,
      saving: false,
      bulkSaving: false,
      forms: [],
      keyword: '',
      statusFilter: '',
      statusOptions: [
        { value: '', label: '全部', color: '#3370ff' },
        { value: 'live', label: '已开放', color: '#409eff' },
        { value: 'idle', label: '未开放', color: '#909399' },
        { value: 'voided', label: '已作废', color: '#f56c6c' }
      ],
      tab: 'forms',
      selected: null,
      config: {},
      configVisible: false,
      membersVisible: false,
      memberRows: [],
      candidates: [],
      departmentRows: [],
      departmentList: [],
      departmentRoster: [],
      comboText: '',
      comboVisible: false,
      comboPanelWidth: 360,
      requiredVisible: false,
      requiredData: null,
      requiredSubjects: [],
      requiredRequireMembers: false,
      requiredLoading: false,
      requiredSaving: false,
      requiredComboText: '',
      requiredComboVisible: false,
      requiredPanelWidth: 360,
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
      roomy: window.innerWidth >= 1440,
      viewportHeight: window.innerHeight,
      decisions,
      progresses
    }
  },
  computed: {
    filtered() {
      return this.forms.filter((form) => {
        const keywordMatch = this.plain(form.name).includes(this.keyword)
        const statusMatch = !this.statusFilter || this.formStatus(form).key === this.statusFilter
        return keywordMatch && statusMatch
      })
    },
    dialogWidth() {
      return this.mobile ? '94%' : '520px'
    },
    drawerWidth() {
      return this.mobile ? '100%' : '560px'
    },
    permissionGridStyle() {
      const count = Math.max(1, this.permissionDefinitions.length)
      return { gridTemplateColumns: `110px repeat(${count}, minmax(84px, 1fr)) 108px` }
    },
    grantRows() {
      // 只拼接原对象引用，表格内的 v-model 才能直接改两套数组
      return [...this.departmentRows, ...this.memberRows]
    },
    comboTree() {
      // 只依赖部门目录与名册；不要依赖授权行，否则每次添加都会重建树并丢失展开/滚动状态
      const nodes = new Map()
      this.departmentList.forEach((department) => {
        nodes.set(department.deptKey, {
          id: 'dept:' + department.deptKey,
          type: 'department',
          deptKey: department.deptKey,
          name: department.name,
          label: this.departmentLabel(department),
          memberCount: department.memberCount,
          children: []
        })
      })
      const roots = []
      this.departmentList.forEach((department) => {
        const node = nodes.get(department.deptKey)
        const parent = department.parentKey ? nodes.get(department.parentKey) : null
        if (parent && parent !== node) parent.children.push(node)
        else roots.push(node)
      })
      const unassigned = []
      this.departmentRoster.forEach((row) => {
        const node = {
          id: 'member:' + row.userId + ':' + (row.deptKey || 'none'),
          type: 'member',
          userId: String(row.userId),
          name: row.name,
          label: row.name,
          children: []
        }
        const parent = row.deptKey ? nodes.get(row.deptKey) : null
        if (parent) parent.children.push(node)
        else unassigned.push(node)
      })
      if (unassigned.length)
        roots.push({
          id: 'group:unassigned',
          type: 'group',
          name: '未分配部门',
          label: '未分配部门',
          children: unassigned
        })
      return roots
    },
    grantTableMaxHeight() {
      return Math.max(240, this.viewportHeight - (this.mobile ? 470 : 440))
    },
    roundModeText() {
      const mode = (this.requiredData && this.requiredData.roundMode) || 'NONE'
      if (mode === 'SINGLE') return '单轮'
      if (mode === 'PERIODIC')
        return '周期（' + ((this.requiredData && this.requiredData.roundPeriod) === 'QUARTER' ? '每季' : '每月') + '）'
      return '不启用'
    },
    requiredEndText() {
      const end = this.requiredData && this.requiredData.roundEndTime
      return end ? String(end).replace('T', ' ').substring(0, 16) : '未设置'
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
    },
    canDocument(value) {
      if (!value && this.tab !== 'forms') this.tab = 'forms'
    },
    comboText(value) {
      this.applyComboFilter(value)
    },
    requiredComboText(value) {
      this.applyRequiredFilter(value)
    },
    requiredVisible(value) {
      if (!value) {
        this.requiredComboVisible = false
        this.requiredComboText = ''
      }
    },
    membersVisible(value) {
      if (!value) {
        this.comboVisible = false
        this.comboText = ''
      }
    }
  },
  async created() {
    this.loading = true
    try {
      const permissions = await refreshDemand()
      this.isGlobal = !!permissions.global
      this.canDocument = !!permissions.documentAccess || this.isGlobal
      this.canCreate = !!permissions.formManage || this.isGlobal
      this.permissionApi = !!permissions.permissionApi
      this.allowed = this.mode === 'admin' ? this.isGlobal : this.canDocument
      if (this.allowed) await this.load()
    } finally {
      this.loading = false
    }
    window.addEventListener('resize', this.resize)
  },
  mounted() {
    document.addEventListener('mousedown', this.onComboOutside)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('mousedown', this.onComboOutside)
  },
  methods: {
    resize() {
      this.mobile = window.innerWidth < 768
      this.roomy = window.innerWidth >= 1440
      this.viewportHeight = window.innerHeight
      if (this.comboVisible) this.syncComboPanelWidth()
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
          collectOnly: false,
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
    formStatus(form) {
      if (form.voided) return { key: 'voided', text: '已停止', className: 'is-voided' }
      if (form.published && Number(form.status) === 2)
        return { key: 'live', text: '已开放', className: 'is-live' }
      return { key: 'idle', text: '未开放', className: 'is-idle' }
    },
    handleCardCommand(command, form) {
      if (command === 'void' || command === 'restore') return this.toggleVoid(form)
      if (command === 'delete') return this.deleteCollection(form)
    },
    openConfig(form) {
      this.selected = form
      this.config = {
        summary: form.summary || '',
        visibility: form.visibility || 'LOGIN',
        collectOnly: !!form.collectOnly,
        allowAnonymous: !!form.allowAnonymous,
        published: !!form.published,
        endTime: form.endTime ? String(form.endTime).replace('T', ' ').substring(0, 19) : null,
        roundMode: form.roundMode || 'NONE',
        roundPeriod: form.roundPeriod || 'MONTH',
        roundEndTime: form.roundEndTime
          ? String(form.roundEndTime).replace('T', ' ').substring(0, 19)
          : null,
        reminderMode: form.reminderMode || 'DEFAULT',
        requireMembers: !!form.requireMembers,
        requiresLeaderApproval: !!form.requiresLeaderApproval,
        revision: form.revision || 0
      }
      this.configVisible = true
    },
    leaderApprovalChanged(value) {
      if (value) this.config.allowAnonymous = false
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
    async openRequired() {
      if (!this.selected) return
      this.requiredVisible = true
      this.requiredData = null
      this.requiredSubjects = []
      await this.loadRequired()
    },
    async loadRequired() {
      if (!this.selected) return
      this.requiredLoading = true
      try {
        const data = (await api.requiredMembers(this.selected.formKey)).data || {}
        this.requiredData = data
        this.requiredSubjects = (data.subjects || []).map((row) => ({
          type: row.type,
          id: String(row.id),
          name: row.name,
          rowKey: row.type + ':' + row.id
        }))
        this.requiredRequireMembers = !!data.requireMembers
      } catch (e) {
        this.$message.error(e.msg || '必填人加载失败')
      } finally {
        this.requiredLoading = false
      }
    },
    isRequiredAdded(data) {
      if (!data || data.type === 'group') return false
      const type = data.type === 'department' ? 'DEPT' : 'USER'
      const id = data.type === 'department' ? data.deptKey : data.userId
      return this.requiredSubjects.some(
        (row) => row.type === type && String(row.id) === String(id)
      )
    },
    requiredNodeHint(data) {
      if (this.isRequiredAdded(data)) return '已添加'
      if (data.type === 'department') return '含下级 ' + Number(data.memberCount || 0) + ' 人'
      return ''
    },
    addRequiredNode(data) {
      if (!data || data.type === 'group' || this.isRequiredAdded(data)) return
      const type = data.type === 'department' ? 'DEPT' : 'USER'
      const id = data.type === 'department' ? data.deptKey : data.userId
      this.requiredSubjects.push({
        type,
        id: String(id),
        name: data.name,
        rowKey: type + ':' + id
      })
    },
    removeRequiredSubject(row) {
      this.requiredSubjects = this.requiredSubjects.filter(
        (item) => !(item.type === row.type && String(item.id) === String(row.id))
      )
    },
    sourceText(sources) {
      const labels = { USER: '组织成员', DEPT: '按部门', MEMBER: '收集单成员' }
      return (sources || []).map((source) => labels[source] || source).join('、')
    },
    async saveRequired() {
      if (!this.selected) return
      this.requiredSaving = true
      try {
        await api.saveRequiredMembers(this.selected.formKey, {
          subjects: this.requiredSubjects.map((row) => ({ type: row.type, id: row.id })),
          requireMembers: !!this.requiredRequireMembers
        })
        this.$message.success('必填人已保存')
        await this.loadRequired()
        await this.load()
      } catch (e) {
        this.$message.error(e.msg || '必填人保存失败')
      } finally {
        this.requiredSaving = false
      }
    },
    openRequiredCombo() {
      this.requiredComboVisible = true
      this.$nextTick(() => {
        this.syncRequiredPanelWidth()
        this.applyRequiredFilter(this.requiredComboText)
      })
    },
    applyRequiredFilter(value) {
      this.$nextTick(() => {
        if (this.$refs.requiredTree) this.$refs.requiredTree.filter(String(value || ''))
      })
    },
    syncRequiredPanelWidth() {
      const input = this.$refs.requiredInput
      const width = input && input.$el ? input.$el.getBoundingClientRect().width : 0
      if (width > 0) this.requiredPanelWidth = Math.floor(width)
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
    async deleteCollection(form) {      const demands = Number(form.demandCount || 0)
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
    async deleteDemand(row) {
      if (!row.canManage) return
      try {
        await this.$confirm(
          `删除后，需求「${row.title}」的消息、已读和公示将不可恢复；原答卷仍保留在原表单数据中。确认删除？`,
          '删除需求',
          { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
        )
      } catch (e) {
        return
      }
      this.saving = true
      try {
        await api.deleteRequest(row.id, { revision: row.revision })
        this.$message.success('需求已删除')
        await this.loadTable()
        await this.loadTableForms()
        await refreshDemand()
      } catch (e) {
        if (e && e.code === 409) await this.loadTable()
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
      const [members, departments, departmentRows, roster] = await Promise.all([
        api.members(form.formKey),
        api.departments(),
        api.departmentMembers(form.formKey),
        api.departmentRoster()
      ])
      this.memberRows = (members.data || []).map((m) => ({ ...m, rowType: 'member' }))
      this.departmentList = departments.data || []
      this.departmentRoster = roster.data || []
      this.departmentRows = (departmentRows.data || []).map((d) => ({
        ...d,
        rowType: 'department'
      }))
      this.comboText = ''
      this.comboVisible = false
      this.membersVisible = true
    },
    async searchUsers(keyword) {
      this.candidates = (await api.users(keyword)).data
    },
    departmentLabel(department) {
      const names = []
      const seen = new Set()
      let current = department
      while (current && !seen.has(current.deptKey)) {
        seen.add(current.deptKey)
        names.unshift(current.name)
        current = current.parentKey
          ? this.departmentList.find((item) => item.deptKey === current.parentKey)
          : null
      }
      return names.join(' / ')
    },
    isDepartmentAdded(department) {
      return this.departmentRows.some((row) => row.deptKey === department.deptKey)
    },
    isMemberAdded(user) {
      const id = user && user.userId !== undefined ? user.userId : user && user.id
      return this.memberRows.some((row) => String(row.userId) === String(id))
    },
    openCombo() {
      this.comboVisible = true
      this.$nextTick(() => {
        this.syncComboPanelWidth()
        this.applyComboFilter(this.comboText)
      })
    },
    closeCombo() {
      this.comboVisible = false
    },
    syncComboPanelWidth() {
      const input = this.$refs.comboInput
      const width = input && input.$el ? input.$el.getBoundingClientRect().width : 0
      if (width > 0) this.comboPanelWidth = Math.floor(width)
    },
    applyComboFilter(value) {
      this.$nextTick(() => {
        if (this.$refs.memberTree) this.$refs.memberTree.filter(String(value || ''))
      })
    },
    filterComboNode(value, data) {
      const query = String(value || '').trim()
      if (!query) return true
      const text = data.type === 'department' ? data.label + ' ' + data.name : data.name
      return String(text || '').includes(query)
    },
    onComboOutside(event) {
      if (!this.comboVisible) return
      const input = this.$refs.comboInput && this.$refs.comboInput.$el
      if (input && input.contains(event.target)) return
      if (event.target.closest && event.target.closest('.member-tree-popper')) return
      this.comboVisible = false
    },
    isComboAdded(data) {
      if (!data || data.type === 'group') return false
      return data.type === 'department' ? this.isDepartmentAdded(data) : this.isMemberAdded(data)
    },
    comboNodeTitle(data) {
      return data.type === 'department' ? data.label : data.name
    },
    comboNodeHint(data) {
      if (this.isComboAdded(data)) return '已添加'
      if (data.type === 'department') return '含下级 ' + Number(data.memberCount || 0) + ' 人'
      if (data.type === 'group') return data.children.length + ' 人'
      return ''
    },
    comboCircleLabel(data) {
      const label = (data.type === 'department' ? '部门 ' : '成员 ') + data.name
      return this.isComboAdded(data) ? label + ' 已添加' : '添加' + label
    },
    addComboNode(data) {
      if (!data || data.type === 'group') return
      this.addComboOption({
        type: data.type === 'department' ? 'department' : 'user',
        key: data.type === 'department' ? data.deptKey : data.userId,
        label: data.name
      })
    },
    addComboOption(item) {
      if (!item) return
      if (item.type === 'department') {
        const department = this.departmentList.find((d) => d.deptKey === item.key)
        if (!department) return
        if (this.isDepartmentAdded(department)) return this.$message.info('该部门已在列表中')
        this.departmentRows.push({
          deptKey: department.deptKey,
          name: department.name,
          memberCount: department.memberCount,
          rowType: 'department',
          canFill: false,
          canHandle: false,
          canManage: false
        })
      } else if (item.type === 'user') {
        if (this.memberRows.some((row) => String(row.userId) === String(item.key)))
          return this.$message.info('该人员已在列表中')
        const roster = this.departmentRoster.find((row) => String(row.userId) === String(item.key))
        this.memberRows.push({
          userId: item.key,
          name: item.label || (roster && roster.name) || item.key,
          rowType: 'member',
          canFill: false,
          canHandle: false,
          canManage: false
        })
      }
      this.$nextTick(() => {
        if (this.comboVisible && this.$refs.comboInput) this.$refs.comboInput.focus()
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
          const [departments, departmentRows, roster] = await Promise.all([
            api.departments(),
            api.departmentMembers(this.selected.formKey),
            api.departmentRoster()
          ])
          this.departmentList = departments.data || []
          this.departmentRoster = roster.data || []
          this.departmentRows = (departmentRows.data || []).map((d) => ({
            ...d,
            rowType: 'department'
          }))
          this.applyComboFilter(this.comboText)
        }
      } finally {
        this.departmentImportSaving = false
      }
    },
    async openRoles() {
      this.rolesVisible = true
      if (this.permissionApi) {
        await this.loadPermissionMatrix()
      } else {
        this.roleRows = (await api.admins()).data
      }
      await this.searchUsers('')
    },
    async loadPermissionMatrix() {
      const response = await api.permissionMatrix()
      const data = response.data || {}
      this.permissionDefinitions = data.capabilities || []
      this.globalOnly = data.globalOnly || []
      this.permissionRows = (data.users || []).map((row) => ({
        ...row,
        capabilities: [...(row.capabilities || [])]
      }))
    },
    async addPermissionUser() {
      if (!this.roleUserId) return this.$message.warning('请选择人员')
      const user = this.candidates.find((item) => String(item.id) === String(this.roleUserId))
      if (!user) return this.$message.warning('请选择人员')
      if (this.permissionRows.some((row) => String(row.userId) === String(user.id)))
        return this.$message.warning('该人员已在授权列表')
      this.permissionRows.push({
        userId: String(user.id),
        name: user.name,
        capabilities: ['form.manage']
      })
      this.roleUserId = ''
    },
    async savePermissionRow(row) {
      this.saving = true
      try {
        await api.savePermissions(row.userId, row.capabilities)
        this.$message.success('平台权限已保存')
        await this.loadPermissionMatrix()
        await this.refreshPagePermissions()
      } finally {
        this.saving = false
      }
    },
    async revokePermissionRow(row) {
      try {
        await this.$confirm(`确认撤销 ${row.name} 的全部平台权限？`, '撤销平台权限', {
          type: 'warning'
        })
      } catch (e) {
        return
      }
      this.saving = true
      try {
        await api.savePermissions(row.userId, [])
        this.$message.success('平台权限已撤销')
        await this.loadPermissionMatrix()
        await this.refreshPagePermissions()
      } finally {
        this.saving = false
      }
    },
    async refreshPagePermissions() {
      const permissions = await refreshDemand()
      this.isGlobal = !!permissions.global
      this.canDocument = !!permissions.documentAccess || this.isGlobal
      this.canCreate = !!permissions.formManage || this.isGlobal
      this.permissionApi = !!permissions.permissionApi
      this.allowed = this.mode === 'admin' ? this.isGlobal : this.canDocument
      if (!this.allowed) this.$router.replace('/demand/home')
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
    readTableRow(id) {
      const row = this.rows.find((item) => item.id === id)
      if (row) row.unread = false
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
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  flex-shrink: 0;
}
.admin-actions .el-button {
  padding: 0 12px;
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
.member-combo {
  margin: 12px 0 4px;
}
.member-combo ::v-deep .el-popover__reference-wrapper {
  display: block;
  width: 100%;
}
.member-combo-tip {
  margin: 6px 0 12px;
  font-size: 12px;
}
.member-tree-panel {
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
  text-align: left;
}
.member-tree ::v-deep .el-tree-node__content {
  height: 34px;
}
.member-tree-row {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-right: 4px;
}
.member-tree-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.member-tree-hint {
  flex: 0 0 auto;
  color: #8f959e;
  font-size: 12px;
}
.member-tree-row.is-added .member-tree-name {
  color: #c0c4cc;
}
.member-tree-row.is-group {
  color: #8f959e;
}
.member-tree-row.is-group .member-tree-name {
  font-weight: 600;
}
.member-tree-circle {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1.5px solid #c0c4cc;
  border-radius: 50%;
  background: #fff;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}
.member-tree-circle:hover {
  border-color: #3370ff;
}
.member-tree-circle.is-added {
  border-color: #3370ff;
  background: #3370ff;
  cursor: default;
}
.member-tree-circle:disabled {
  opacity: 1;
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
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.member-grant-count {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
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
  .admin-actions {
    flex-wrap: wrap;
    flex-shrink: 1;
    width: 100%;
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
.permission-matrix {
  margin-top: 12px;
  overflow-x: auto;
}
.permission-matrix-head,
.permission-matrix-row {
  display: grid;
  grid-template-columns: 110px repeat(3, minmax(84px, 1fr)) 108px;
  align-items: center;
  gap: 8px;
  min-width: 520px;
  padding: 8px 4px;
  border-bottom: 1px solid #ebeef5;
}
.permission-matrix-head {
  color: #909399;
  font-size: 12px;
  font-weight: 600;
}
.permission-matrix-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.permission-cell {
  display: flex;
  justify-content: center;
}
.permission-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}
.permission-global-only {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
}
.permission-global-only .demand-muted {
  width: 100%;
  margin: 0;
}
.required-members-toggle {
  margin: 8px 0 12px;
}
.required-subject-table {
  margin-bottom: 10px;
}
.required-summary {
  margin: 10px 0 12px;
  color: #5c6675;
  font-size: 13px;
}
.required-list-title {
  margin: 18px 0 10px;
  font-size: 15px;
}
</style>
