<template>
  <div class="write-container">
    <div v-if="demandMeta.managed" class="demand-write-header">
      <router-link to="/demand/home">{{ $brand.name }}</router-link>
      <div>
        <router-link v-if="logged" to="/demand/mine">我的需求</router-link
        ><router-link to="/demand/lookup">匿名需求查询</router-link>
      </div>
    </div>
    <div v-if="demandMeta.managed && writeStatus !== 2" class="demand-write-mode">
      <span>填报方式</span
      ><el-radio-group v-model="demandMode" @change="modeChanged"
        ><el-radio label="login">登录填写〔默认〕</el-radio
        ><el-radio v-if="demandMeta.allowAnonymous" label="anonymous">匿名填写</el-radio></el-radio-group
      >
      <div v-if="demandMode === 'login' && !logged" class="demand-login-gate">
        <p>登录后可在“我的需求”查看回复与实施进度。</p>
        <el-button type="primary" @click="demandLogin">登录并开始填写</el-button>
      </div>
      <p v-else class="demand-mode-hint">
        {{
          demandMode === 'anonymous'
            ? '本次匿名提交，不关联登录账户。提交后请保存查询码。'
            : '本次以当前登录账户提交，可在“我的需求”查看后续回复。'
        }}
      </p>
      <p v-if="demandMeta.requiredOfMe" class="demand-mode-hint demand-required-hint">
        您是本轮必填人{{
          demandMeta.roundEndTime
            ? '，请在 ' + String(demandMeta.roundEndTime).replace('T', ' ').substring(0, 16) + ' 前提交'
            : ''
        }}；匿名提交不计入必填完成。
      </p>
    </div>
    <el-alert v-if="demandLoadError" :title="demandLoadError" type="error" :closable="false" />
    <form-qrcode v-if="!demandMeta.managed" />
    <h1 id="inActiveTime" style="display: none" />
    <div v-cloak v-if="writeStatus == 0">
      <el-result :title="writeNotStartPrompt" icon="error" />
    </div>
    <div v-cloak v-if="writeStatus == 3">
      <el-card class="pwdinput-card text-center">
        <div slot="header" class="clearfix">
          <span> 请输入密码填写</span>
        </div>
        <el-input v-model="writePassword" placeholder="请输入密码填写" />
        <el-button class="width50 mt20" type="primary" @click="handleCheckWritePwd"> 确定</el-button>
      </el-card>
    </div>
    <div v-if="writeStatus == 1 && demandCanWrite" class="form-container">
      <biz-project-form v-if="formConfig.formKey" ref="bizProjectForm" :form-config="formConfig" @submit="submitForm" />
    </div>
    <div v-cloak v-if="writeStatus == 2" class="title-icon-view">
      <div v-if="submitResult.demandReceipt" class="demand-receipt">
        <el-result title="提交成功" icon="success" />
        <p>需求编号：{{ submitResult.demandReceipt.requestNo }}</p>
        <template v-if="submitResult.demandReceipt.anonymous"
          ><p>请保存查询码，后续凭编号和查询码查看回复。</p>
          <p v-if="demandMeta.requiredOfMe" class="demand-required-hint">
            匿名提交不计入必填完成；如需计入，请登录后重新提交。
          </p>
          <el-input :value="submitResult.demandReceipt.queryCode" readonly show-password />
          <div class="receipt-actions">
            <el-button @click="copyReceipt">复制查询信息</el-button
            ><el-button type="primary" @click="openReceipt">查看处理进度</el-button>
          </div></template
        >
        <template v-else
          ><p v-if="submitResult.demandReceipt.approvalPending">
            已提交，等待部门主管审批；通过后进入单据处理流程。
          </p>
          <p v-else>已加入“我的需求”，处理后的回复和进度将在其中显示。</p>
          <el-button type="primary" @click="openReceipt">查看我的需求</el-button></template
        >
        <el-button type="text" @click="$router.push('/demand/home')">返回首页</el-button>
      </div>
      <div v-else-if="userFormSetting.submitShowType === 2" v-html="userFormSetting.submitShowCustomPageContent" />
      <el-result v-else :title="'提交成功'" icon="success" />
    </div>
  </div>
</template>

<script>
import Cookies from 'js-cookie'
import { formInfo as demandFormInfo } from '@/api/demand'
import { BizProjectForm } from 'tduck-form-generator'
import 'tduck-form-generator/dist/TduckForm.css'
import { getQueryString } from '@/utils'
import constants from '@/utils/constants'
import { removeFormData } from '@/utils/db'
import { getAuthorizationUrl, getAuthorizationUserInfo, getWxSignature } from '@/api/project/wxmp'
import { isWxEnv, onlyWxOpenHandle, setWxConfig } from './wx'
import TduckFormMixin from '../TduckFormMixin'
import { createFormResultRequest, publicCreateFormResultRequest, viewFormResultRequest } from '@/api/project/data'
import { checkWritePwdRequest, getPublicSettingsRequest, getWriteSettingStatusRequest } from '@/api/project/setting'
import { jumpUrl } from './SubmitJump'
import { checkWriteCountCap, saveWriteCount } from '@/views/form/write/DeviceWriteCount'
import FormQrcode from '@/views/form/write/FormQrcode.vue'

const uaParser = require('ua-parser-js')
const ua = uaParser(navigator.userAgent)

require('@/utils/ut')

export default {
  name: 'WriteView',
  components: {
    FormQrcode,
    BizProjectForm
  },
  mixins: [TduckFormMixin],
  props: {
    // 1：公开填写 2：指定成员填写
    writeType: {
      type: Number,
      default: 1
    }
  },
  data() {
    return {
      demandMeta: { managed: false },
      demandMode: 'login',
      demandInitialized: false,
      demandLoadError: '',
      formKey: '',
      writePassword: '',
      inActiveTime: 0,
      formConfig: {
        formKey: '',
        preview: false,
        showBtns: true,
        supportText: this.$brand.footer
      },
      writeStatus: 1,
      // 不允许填写的提示信息
      writeNotStartPrompt: '',
      userFormSetting: {},
      // 微信授权地址
      wxAuthorizationUrl: '',
      wxAuthorizationCode: '',
      wxUserInfo: {},
      wxSignature: {},
      // 待提交表单数据
      submitFormData: {
        completeTime: null,
        formKey: null,
        submitOs: ua.os.name,
        submitBrowser: ua.browser.name,
        submitUa: ua,
        wxUserInfo: null,
        wxOpenId: null,
        writePassword: '',
        originalData: null
      },
      // 提交后返回的数据
      submitResult: {
        // 随机编号
        randomNumberText: '',
        // 考试成绩
        examScoreText: ''
      }
    }
  },
  computed: {
    logged() {
      return !!this.$store.getters['user/isLogin']
    },
    demandCanWrite() {
      return !this.demandMeta.managed || this.demandMode === 'anonymous' || this.logged
    }
  },
  async created() {
    this.formKey = this.$route.query.key || this.$route.params.key
    try {
      this.demandMeta = (await demandFormInfo(this.formKey)).data || { managed: false }
      if (this.demandCanWrite) await this.initializeOriginalForm()
    } catch (e) {
      this.demandLoadError = e.msg || '暂时无法加载收集单，请刷新后重试。'
    }
  },
  methods: {
    async initializeOriginalForm() {
      if (this.demandInitialized) return
      this.demandInitialized = true

      this.formKey = this.$route.query.key || this.$route.params.key
      // cookie获取微信用户信息
      this.getCookieAuthorizationUserInfo()
      // 微信授权重定向到该页 会携带code参数
      let wxCode = getQueryString('code')
      if (wxCode) {
        this.wxAuthorizationCode = wxCode
        await this.getWxAuthorizationUserInfo()
      }
      // 微信逻辑授权结束 授权地址
      this.getWxAuthorizationUrl()
      // 检查是否能进入填写
      this.queryProjectSettingStatus()
      // 查询相关设置 检查是否能打开等
      let settingRes = await this.queryProjectSetting()
      // 非微信环境不加载微信相关 加快访问速度
      if (constants.enableWx && isWxEnv()) {
        // 加载微信相关 获取签名
        getWxSignature({ url: window.location.href }).then((res) => {
          this.wxSignature = res.data
          setWxConfig(this.wxSignature, settingRes.data)
        })
      }
      viewFormResultRequest(this.formKey).then(() => {})
    },
    modeChanged() {
      if (this.demandCanWrite)
        this.initializeOriginalForm().catch((e) => {
          this.demandLoadError = e.msg || '加载失败，请刷新后重试。'
        })
    },
    demandLogin() {
      this.$router.push({ path: '/login/entry', query: { redirect: this.$route.fullPath } })
    },
    async copyReceipt() {
      const r = this.submitResult.demandReceipt
      await this.$copyText(`需求编号：${r.requestNo}\n查询码：${r.queryCode}`)
      this.$message.success('查询信息已复制，请妥善保存')
    },
    openReceipt() {
      const r = this.submitResult.demandReceipt
      if (r.anonymous)
        this.$router.push({
          name: 'DemandLookup',
          params: { receipt: { requestNo: r.requestNo, queryCode: r.queryCode } }
        })
      else this.$router.push({ path: '/demand/mine', query: { id: r.id } })
    },

    queryProjectSettingStatus() {
      // 是否能进入填写
      getWriteSettingStatusRequest({
        formKey: this.formKey,
        type: this.writeType,
        wxOpenId: this.wxUserInfo ? this.wxUserInfo.openid : ''
      }).then((res) => {
        if (res.msg) {
          this.writeNotStartPrompt = res.msg
          this.writeStatus = 0
        }
      })
    },
    getCookieAuthorizationUserInfo() {
      // cookie缓存拿一次 没有的话调接口拿
      let wxUserInfo = Cookies.get('wxUserInfo')
      if (wxUserInfo) {
        wxUserInfo = JSON.parse(wxUserInfo)
        console.log(wxUserInfo)
        if (wxUserInfo.openid) {
          this.wxUserInfo = wxUserInfo
        }
      }
    },
    getWxAuthorizationUserInfo() {
      // 根据code 获取用户授权信息
      let wxAuthorizationCode = this.wxAuthorizationCode
      return getAuthorizationUserInfo({
        code: wxAuthorizationCode
      }).then((res) => {
        if (res.data) {
          console.log('wxuser')
          this.wxUserInfo = res.data
          Cookies.set('wxUserInfo', JSON.stringify(res.data))
          console.log(this.wxUserInfo)
        }
      })
    },
    getWxAuthorizationUrl() {
      // 获取微信授权url地址
      getAuthorizationUrl({ url: window.location.href }).then((res) => {
        if (res.data) {
          this.wxAuthorizationUrl = res.data
        }
      })
    },
    async queryProjectSetting() {
      // 填写设置
      let res = await getPublicSettingsRequest(this.formKey)
      this.formConfig.formKey = this.formKey
      if (res.data) {
        this.userFormSetting = res.data
        this.formConfig.setting = res.data
        // 设备填写次数校验
        this.checkDeviceWriteLimit()
        // 仅在微信环境打开
        if (res.data && res.data.onlyWxWrite) {
          // 记录微信用户信息
          if (res.data.recordWxUser && !this.wxAuthorizationCode) {
            if (Object.keys(this.wxUserInfo).length === 0) {
              location.href = this.wxAuthorizationUrl
            }
          } else {
            onlyWxOpenHandle()
          }
        }
        // 开启了密码填写
        if (res.data && res.data.passwordWriteStatus) {
          this.writeStatus = 3
        }
      }
      return res
    },
    /**
     * 检查设备填写次数
     */
    checkDeviceWriteLimit() {
      if (this.userFormSetting.deviceWriteCountLimitStatus) {
        const flag = checkWriteCountCap(this.formKey, this.userFormSetting.deviceWriteCountLimit)
        if (flag) {
          this.writeNotStartPrompt = this.userFormSetting.deviceWriteCountLimitText
          this.writeStatus = 0
        }
        return flag
      }
    },
    handleCheckWritePwd() {
      checkWritePwdRequest({
        formKey: this.formKey,
        password: this.writePassword
      }).then((res) => {
        this.writeStatus = 1
      })
    },
    async submitForm(data) {
      // 完成时间
      this.submitFormData.completeTime = document.getElementById('inActiveTime').innerText
      this.submitFormData.wxUserInfo = this.wxUserInfo
      this.submitFormData.wxOpenId = this.wxUserInfo ? this.wxUserInfo.openid : ''
      this.submitFormData.originalData = data.formModel
      this.submitFormData.formKey = this.formKey
      this.submitFormData.formId = data.formId
      this.submitFormData.formType = this.$refs.bizProjectForm.formConf.formType
      this.submitFormData.writePassword = this.writePassword
      if (this.demandMeta.managed) this.submitFormData.demandAnonymous = this.demandMode === 'anonymous'
      let res = null
      if (this.writeType === 1) {
        res = await publicCreateFormResultRequest(this.submitFormData)
      } else {
        res = await createFormResultRequest(this.submitFormData)
      }
      this.handleSubmitSuccess(res.data)
    },
    // 提交成功后处理
    handleSubmitSuccess(data) {
      this.submitResult = data
      // 删除临时缓存数据
      removeFormData(this.formKey)
      // 如果开启了设备填写次数限制 则保存记录
      saveWriteCount(this.formKey)
      this.writeStatus = 2
      if (!this.demandMeta.managed && this.userFormSetting.submitJump) {
        jumpUrl(this.userFormSetting.submitJumpUrl, data.id)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.write-container {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow-x: hidden;
}

.title-icon-view {
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.icon-view {
  width: 59px;
  height: 59px;
  border-radius: 100px;
  background-color: #0076ff;
  display: flex;
  align-content: center;
  align-items: center;
  justify-content: center;
}

.success-icon {
  text-align: center;
  color: white;
  font-size: 30px;
}

.pwdinput-card {
  width: 350px;
  margin: 200px auto;
  min-height: 200px;
}
::v-deep .project-form {
  padding: 20px;
}
</style>

<style scoped>
.demand-write-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  gap: 14px;
}
.demand-write-header a {
  color: #3370ff;
  text-decoration: none;
}
.demand-write-header > div {
  display: flex;
  gap: 18px;
}
.demand-write-mode {
  max-width: 900px;
  margin: 20px auto;
  padding: 22px 24px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-sizing: border-box;
}
.demand-write-mode > span {
  margin-right: 20px;
  color: #606266;
}
.demand-mode-hint,
.demand-login-gate p {
  color: #909399;
  font-size: 13px;
  line-height: 1.8;
}
.demand-required-hint {
  color: #e6a23c;
}
.demand-login-gate {
  margin-top: 20px;
}
.demand-receipt {
  max-width: 600px;
  padding: 24px;
  text-align: center;
  box-sizing: border-box;
}
.receipt-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin: 20px 0;
}
.demand-receipt p {
  line-height: 1.8;
}
.demand-receipt > .el-button--text {
  display: block;
  margin: 20px auto 0;
}
.demand-receipt .el-input {
  max-width: 460px;
}
@media (max-width: 767px) {
  .demand-write-header {
    padding: 16px;
    font-size: 13px;
    flex-wrap: wrap;
  }
  .demand-write-mode {
    margin: 12px;
    padding: 18px;
  }
  .demand-write-mode .el-radio-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
  .demand-write-mode .el-radio {
    margin: 0;
  }
  .demand-receipt {
    width: 100%;
    padding: 18px;
  }
  .title-icon-view {
    height: auto !important;
    min-height: 70vh;
  }
}
</style>
