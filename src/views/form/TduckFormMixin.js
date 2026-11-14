import TduckForm from 'tduck-form-generator'
import store from '@/store/index'
import { brand } from '@/config/brand'

export default {
  data() {
    return {
      formKey: null
    }
  },
  created() {
    if (this.formConfig) this.$set(this.formConfig, 'supportText', brand.footer)
    // 写入值到localStorage 给组件使用
    if (store.state.user.token) {
      localStorage.setItem(TduckForm.constant.ACCESS_TOKEN, store.state.user.token)
    }
  }
}
