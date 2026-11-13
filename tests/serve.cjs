const http = require('http')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../dist')
const types = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.html': 'text/html', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let file = path.resolve(root, '.' + relative)
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}).listen(18888, '127.0.0.1')
