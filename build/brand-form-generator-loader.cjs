// 仅替换依赖的可见文案，保留内部标识。
const { brand } = require('../src/config/brand')
module.exports = (source) =>
  source
    .split('Powered By Tduck 填鸭表单')
    .join(brand.footer)
    .split('https://api.tduckcloud.com/xxx.json')
    .join('https://example.com/options.json')
