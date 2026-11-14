import { resolveXlsxBlob, exportStamp } from '@/utils/demand'

/** 页面导出通用逻辑：生成一次下载，错误只提示一次。 */
export default {
  data() {
    return { exporting: false }
  },
  methods: {
    async saveExport(requestFn, prefix) {
      if (this.exporting) return
      this.exporting = true
      try {
        const response = await requestFn()
        const blob = await resolveXlsxBlob(response)
        this.download(blob, `${prefix}-${exportStamp()}`)
        if (response && response.headers && response.headers['x-export-truncated'] === 'true')
          this.$message.warning('数据量较大，已导出前 10000 条')
      } catch (e) {
        this.$message.error((e && e.message) || '导出失败，请稍后重试')
      } finally {
        this.exporting = false
      }
    }
  }
}
