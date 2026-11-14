// 产品品牌集中配置；内部接口与第三方依赖保持兼容。
const brand = Object.freeze({
  name: '瑞玛问卷系统',
  englishName: 'RUIMA Survey',
  footer: 'RUIMA Survey',
  version: '20261114',
  logo: '/ruima-logo.png?v=20261114',
  icon: '/favicon.ico?v=20261114',
  appleTouchIcon: '/apple-touch-icon.png?v=20261114'
})
const legacyNames = [
  'Tduck',
  'Tduck填鸭表单',
  'Tduck 填鸭表单',
  '填鸭表单',
  '填鸭',
  'Tduck 表单系统',
  'TDUCK 数据收集系统',
  '瑞玛需求征集'
]
function resolveSystemName(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  return !name || legacyNames.some((old) => old.toLowerCase() === name.toLowerCase()) ? brand.name : name
}
module.exports = { brand, resolveSystemName }
