const { test, expect } = require('@playwright/test')

const statusConfigured = {
  enabled: true,
  configured: true,
  official: true,
  modelName: 'deepseek-v4-flash',
  reasoningModelName: 'deepseek-v4-pro',
  reasoningEffort: 'high',
  thinkingMode: 'native',
  supportsThinking: true,
  message: 'AI 服务已就绪'
}

const statusUnconfigured = {
  enabled: false,
  configured: false,
  official: false,
  modelName: 'deepseek-v4-flash',
  reasoningModelName: 'deepseek-v4-pro',
  reasoningEffort: 'high',
  thinkingMode: 'none',
  supportsThinking: false,
  message: 'AI 服务未配置：请管理员在「系统配置 → AI 配置」中启用服务并填写 API Key。'
}

function envelope(title, questions) {
  return JSON.stringify({ title, description: '', questions })
}

function clarifyPayload(needs, questions, defaults) {
  return JSON.stringify({ needsClarification: needs, questions, defaults: defaults || '' })
}

function sse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function contentEvents(text, thinking) {
  const events = [{ type: 'meta', requestId: 'r1', thinking: !!thinking }]
  if (thinking) events.push({ type: 'thinking', delta: '先分析用户的需求。' })
  const pieces = text.match(/[\s\S]{1,40}/g) || []
  pieces.forEach((piece) => events.push({ type: 'content', delta: piece }))
  events.push({
    type: 'done',
    requestId: 'r1',
    finishReason: 'stop',
    contentLength: text.length,
    thinkingLength: thinking ? 10 : 0
  })
  return sse(events)
}

async function login(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-session')
    localStorage.setItem('userInfo', JSON.stringify({ name: '测试员工', admin: true }))
  })
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
}

async function switchToQuick(page) {
  await page.locator('.ai-mode-switch .el-radio-button').filter({ hasText: '快速生成' }).click()
}

async function mockBase(page, { status, streams = [], items = [] }) {
  const requests = []
  const calls = []
  let streamIndex = 0
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue()
    const path = url.pathname.replace(/^\/tduck-api/, '')
    const json = (data) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data, msg: null })
      })

    if (path === '/ai/status') return json(status)
    if (path === '/ai/gen-form-chat/stream') {
      requests.push(route.request().postDataJSON())
      const body = streams[Math.min(streamIndex, streams.length - 1)]
      streamIndex += 1
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body
      })
    }
    if (path === '/demand-api/capabilities') {
      return json({
        enabled: true,
        admin: true,
        global: true,
        handler: true,
        manage: true,
        mineUnread: 0,
        pending: 0,
        publicationUnread: 0
      })
    }
    if (path === '/user/form/page') return json({ records: [], total: 0, size: 10 })
    if (path === '/user/form/folderTree') return json([])
    if (path === '/user/form/A') {
      return json({ formKey: 'A', name: '测试表单', description: '原说明', type: 1, status: 1 })
    }
    if (path === '/user/form/item/list') return json(items)
    if (path === '/user/form/logic') return json(null)
    if (path.startsWith('/user/form/item/')) {
      calls.push({ path, body: route.request().postDataJSON() })
      return json(null)
    }
    if (path.startsWith('/public/')) return json({})
    if (path.startsWith('/demand-api/') || path.startsWith('/user/')) return json(null)
    return route.continue()
  })
  return { requests, calls }
}

async function openAiDrawer(page) {
  await page.goto('/project/my')
  await page.getByRole('button', { name: 'AI 智能建表' }).click()
  await expect(page.locator('.ai-chat-panel')).toBeVisible()
}

test('AI 未配置时给出明确提示且不发起生成', async ({ page }) => {
  const { requests } = await mockBase(page, { status: statusUnconfigured })
  await login(page)
  await openAiDrawer(page)
  await expect(page.getByText('AI 服务不可用')).toBeVisible()
  await expect(page.getByText('AI 服务未配置', { exact: false }).first()).toBeVisible()
  await expect(page.locator('.ai-textarea textarea')).toBeDisabled()
  expect(requests.length).toBe(0)
})

test('方案模式：澄清 → 方案 → 确认 → 生成', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const clarify = clarifyPayload(
    true,
    [
      {
        id: 'q1',
        question: '这份问卷主要面向谁？',
        options: ['公司员工', '外部客户'],
        allowCustom: true
      }
    ],
    '按公司员工、10 题设计'
  )
  const plan = JSON.stringify({
    title: '远程办公体验调查',
    description: '了解远程办公体验',
    audience: '公司员工',
    questionCount: 2,
    typeMix: { 单选: 1, 多行文本: 1 },
    outline: [
      {
        id: '1',
        type: '单选',
        title: '远程办公效率如何？',
        options: ['提升', '持平', '下降'],
        reason: '了解整体效率'
      },
      { id: '2', type: '多行文本', title: '您有什么建议？', reason: '收集建议' }
    ],
    assumptions: ['面向公司员工'],
    risks: []
  })
  const form = envelope('远程办公体验调查', [
    { type: '单选', title: '远程办公效率如何？', options: ['提升', '持平', '下降'] },
    { type: '多行文本', title: '您有什么建议？' }
  ])
  const { requests } = await mockBase(page, {
    status: statusConfigured,
    streams: [contentEvents(clarify), contentEvents(plan), contentEvents(form)]
  })
  await login(page)
  await openAiDrawer(page)

  const input = page.locator('.ai-textarea textarea')
  await input.fill('生成一份远程办公调查问卷')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('需要先确认几个问题')).toBeVisible({ timeout: 15000 })
  await page.locator('.ai-option').filter({ hasText: '公司员工' }).click()
  await page.getByRole('button', { name: '提交答案' }).click()

  await expect(page.getByText('确认并生成')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('远程办公体验调查').first()).toBeVisible()
  await page.getByRole('button', { name: '确认并生成' }).click()

  await expect(page.getByText('已生成 2 道题目')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.ai-plan-status').filter({ hasText: '已生成' })).toBeVisible()

  expect(requests.length).toBe(3)
  expect(requests[0].stage).toBe('clarify')
  expect(requests[1].stage).toBe('plan')
  expect(requests[2].stage).toBe('generate')
  expect(requests[2].planJson).toContain('远程办公体验调查')
})

test('快速生成、深入思考与连续修正', async ({ page }) => {
  const first = envelope('测试问卷', [
    { type: '单选', title: '第1题', options: ['A', 'B'] },
    { type: '单行文本', title: '第2题' }
  ])
  const second = envelope('测试问卷', [
    { type: '多选', title: '第1题', options: ['A', 'B', 'C'] },
    { type: '单行文本', title: '第2题' },
    { type: '数字', title: '年龄' }
  ])
  const { requests } = await mockBase(page, {
    status: statusConfigured,
    streams: [contentEvents(first, true), contentEvents(second, true)]
  })
  await login(page)
  await openAiDrawer(page)
  await switchToQuick(page)

  await page.locator('.ai-thinking-switch .el-switch').click()
  const input = page.locator('.ai-textarea textarea')
  await input.fill('生成一份测试问卷')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('已生成 2 道题目')).toBeVisible()
  await expect(page.getByText('测试问卷').first()).toBeVisible()
  await expect(page.getByText('思考过程')).toBeVisible()

  await input.fill('把第1题改成多选，并新增年龄题')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('已生成 3 道题目')).toBeVisible()
  await expect(page.getByText('年龄').first()).toBeVisible()

  expect(requests.length).toBe(2)
  expect(requests[0].stage).toBe('generate')
  expect(requests[0].thinking).toBe(true)
  expect(requests[1].thinking).toBe(true)
  expect(requests[1].messages.some((msg) => msg.role === 'assistant')).toBe(true)
  expect(requests[1].currentForm).toContain('第1题')
  await noOverflow(page)
})

test('流式错误可见并提供重试', async ({ page }) => {
  const errorStream = sse([
    { type: 'meta', requestId: 'r1', thinking: false },
    {
      type: 'error',
      code: 'AI_MODEL_NOT_FOUND',
      message: '模型不可用：请改用 deepseek-v4-flash 或 deepseek-v4-pro。',
      retryable: true
    }
  ])
  await mockBase(page, { status: statusConfigured, streams: [errorStream] })
  await login(page)
  await openAiDrawer(page)
  await switchToQuick(page)
  const input = page.locator('.ai-textarea textarea')
  await input.fill('生成一份问卷')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('模型不可用', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
})

test('1024×768 下 AI 抽屉不裁切', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await mockBase(page, { status: statusConfigured })
  await login(page)
  await openAiDrawer(page)
  await expect(page.getByRole('button', { name: '发送' })).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭' })).toBeVisible()
  await expect(page.locator('.ai-thinking-switch')).toBeVisible()
  await expect(page.getByText('方案模式', { exact: true })).toBeVisible()
  await expect(page.getByText('快速生成', { exact: true })).toBeVisible()
  await noOverflow(page)
})

function designerItem(id, formItemId, type, label, sort, options) {
  const config = {
    formId: formItemId,
    label,
    required: false,
    span: 24,
    showLabel: true,
    regList: []
  }
  if (options) {
    config.options = options.map((option, index) => ({
      type: 'option',
      label: option,
      value: index + 1
    }))
  }
  return {
    id,
    formKey: 'A',
    formItemId,
    type,
    label,
    required: false,
    placeholder: '',
    sort,
    span: 24,
    displayType: false,
    hideType: false,
    specialType: false,
    showLabel: true,
    defaultValue: null,
    regList: [],
    scheme: { typeId: type, vModel: formItemId, placeholder: '', config }
  }
}

test('设计器 AI 协作：方案确认后生成并应用', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const items = [
    designerItem(1, 'radio1', 'RADIO', '第1题', 1, ['A', 'B']),
    designerItem(2, 'input1', 'INPUT', '第2题', 2)
  ]
  const clarify = clarifyPayload(false, [], '')
  const plan = JSON.stringify({
    title: '测试表单',
    description: '原说明',
    audience: '公司员工',
    questionCount: 3,
    outline: [
      {
        id: '1',
        type: '多选',
        title: '第1题',
        options: ['A', 'B', 'C'],
        targetFormItemId: 'radio1',
        reason: '改为多选'
      },
      { id: '2', type: '单行文本', title: '第2题', targetFormItemId: 'input1' },
      { id: '3', type: '数字', title: '年龄' }
    ],
    changeSummary: ['将第1题改为多选', '新增数字题“年龄”'],
    assumptions: [],
    risks: []
  })
  const generated = JSON.stringify({
    plan: ['将第1题由单选改为多选', '新增数字题“年龄”'],
    title: '测试表单',
    description: '原说明',
    questions: [
      { formItemId: 'radio1', type: '多选', title: '第1题', options: ['A', 'B', 'C'] },
      { formItemId: 'input1', type: '单行文本', title: '第2题' },
      { type: '数字', title: '年龄' }
    ]
  })
  const { calls, requests } = await mockBase(page, {
    status: statusConfigured,
    streams: [contentEvents(clarify), contentEvents(plan), contentEvents(generated)],
    items
  })
  await login(page)
  await page.goto('/project/form/editor?key=A&ai=1')
  await expect(page.getByText('AI 协作').first()).toBeVisible()
  await expect(page.locator('.designer-chat')).toBeVisible({ timeout: 15000 })
  await noOverflow(page)

  const dock = page.locator('.ai-dock')
  const beforeBox = await dock.boundingBox()
  const resizerBox = await page.locator('.ai-resizer').boundingBox()
  await page.mouse.move(resizerBox.x + 3, resizerBox.y + 120)
  await page.mouse.down()
  await page.mouse.move(resizerBox.x - 40, resizerBox.y + 120, { steps: 5 })
  await page.mouse.up()
  const afterBox = await dock.boundingBox()
  expect(afterBox.width).toBeGreaterThan(beforeBox.width)
  await noOverflow(page)
  await page.screenshot({
    path: 'test-results/ai-designer-dock-1024.png',
    fullPage: true,
    animations: 'disabled'
  })

  const input = page.locator('.designer-chat .ai-textarea textarea')
  await input.fill('把第1题改成多选，并新增年龄题')
  await page.getByRole('button', { name: '发送' }).click()

  await expect(page.getByText('本次变更')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: '确认并生成' })).toBeVisible()
  await page.screenshot({
    path: 'test-results/ai-designer-plan-1024.png',
    fullPage: true,
    animations: 'disabled'
  })
  await page.getByRole('button', { name: '确认并生成' }).click()

  await expect(page.locator('.ai-diff-chip').filter({ hasText: '新增 2' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.ai-diff-chip').filter({ hasText: '删除 1' })).toBeVisible()
  await page.getByRole('button', { name: '应用修改' }).click()
  await expect(page.getByText('已应用到设计器')).toBeVisible()
  await expect(page.locator('.ai-plan-status').filter({ hasText: '已应用' })).toBeVisible()

  expect(requests.length).toBe(3)
  expect(requests[0].stage).toBe('clarify')
  expect(requests[1].stage).toBe('plan')
  expect(requests[2].stage).toBe('generate')
  expect(requests[2].planJson).toContain('将第1题改为多选')

  const created = calls.find((call) => call.path === '/user/form/item/batch/create')
  expect(created).toBeTruthy()
  expect(created.body.length).toBe(2)
  expect(created.body.some((item) => item.type === 'CHECKBOX')).toBeTruthy()
  expect(created.body.some((item) => item.type === 'NUMBER')).toBeTruthy()
  expect(
    calls.some(
      (call) => call.path === '/user/form/item/delete' && call.body.formItemId === 'radio1'
    )
  ).toBeTruthy()
})
