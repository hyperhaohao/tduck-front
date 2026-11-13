const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './tests', testMatch: '**/*.spec.cjs', fullyParallel: false, workers: 1,
  timeout: 30000, use: { baseURL: 'http://127.0.0.1:18888', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/serve.cjs', url: 'http://127.0.0.1:18888', reuseExistingServer: false, timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]]
})
