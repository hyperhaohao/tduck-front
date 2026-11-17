const { test, expect } = require('@playwright/test')
const path = require('path')
const notices = { enabled: true, admin: true, global: true, handler: true, manage: true, mineUnread: 2, pending: 5, publicationUnread: 3 }
const forms = [
  { formKey: 'A', name: '信息化需求征集', summary: '征集业务系统优化、报表改进与工作流程建议。', status: 2, published: true, visibility: 'LOGIN', allowAnonymous: true, revision: 0, demandCount: 2 },
  { formKey: 'B', name: '设备改善需求征集', summary: '提交设备维护、现场改善和安全优化需求。', status: 2, published: true, visibility: 'LOGIN', allowAnonymous: false, revision: 0, demandCount: 0 }
]
const deletedForms = [
  { formKey: 'D', name: '已删除收集单', demandCount: 2, dataCount: 2, deletedAt: '2026-11-16 10:00:00', deletedByName: '维护管理员' },
  { formKey: 'E', name: '空收集单', demandCount: 0, dataCount: 0, deletedAt: '2026-11-16 10:10:00', deletedByName: '维护管理员' }
]
const departments = [
  { deptKey: 'D1', name: '技术部', parentKey: null, path: '/D1', sortNo: 1, memberCount: 3 },
  { deptKey: 'D2', name: '研发组', parentKey: 'D1', path: '/D1/D2', sortNo: 2, memberCount: 2 }
]
let departmentGrants = []
const row = { id: 'demand-1', title: '优化设备维护记录查询', requestNo: 'REQ-20261113-TEST001', formKey: 'A', formName: '信息化需求征集', submitterName: '测试员工', handlerId: '30', handlerName: '测试经办人', decision: 'ACCEPTED', progress: 'IN_PROGRESS', unread: true, revision: 1, publicVersion: 3, createTime: '2026-11-13 09:00:00', replyTime: '2026-11-13 10:00:00', publicationPublished: false, publicationSkipped: false, publicationVersion: 0, canHandle: true, canManage: true }
const rowA2 = { ...row, id: 'demand-3', title: '新增报表导出字段', requestNo: 'REQ-20261113-TEST003', revision: 5, unread: false, formName: '信息化需求征集与设备改善需求联合征集（超长名称用于验证省略）' }
const rowB = { ...row, id: 'demand-2', title: '车间照明改善', requestNo: 'REQ-20261113-TEST002', formKey: 'B', formName: '设备改善需求征集', unread: false }
let detail
let calls = []
let options = {}
function makeDetail(opts = {}) { return { ...row, canViewTable: true, canHandle: true, canAssign: true, canPublish: true, canManage: true, publicationSkipped: false, originalData: { title: row.title, description: '希望能按设备编号查询维护历史，减少重复查找。' }, formFields: [{ value: 'title', label: '需求标题' }, { value: 'description', label: '需求说明' }], reason: '采纳，已安排实施。', completion: '', messages: opts.noReply ? [] : [{ id: 'reply-1', kind: 'REPLY', authorName: '测试经办人', content: '已完成初步评估，目前正在实施。', createTime: '2026-11-13 10:00:00' }], publication: null } }
async function mockApi(page, role = 'all', opts = {}) {
  detail = makeDetail(opts)
  calls = []
  options = opts
  departmentGrants = [{ deptKey: 'D1', name: '技术部', memberCount: 3, canFill: false, canHandle: false, canManage: !opts.noDeptManager }]
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue()
    const api = url.pathname.replace(/^\/tduck-api/, '')
    if (!url.pathname.includes('tduck-api') && !api.startsWith('/demand-api/') && !api.startsWith('/auth/') && !api.startsWith('/user/')) return route.continue()
    if (api === '/demand-api/export/requests' || api === '/demand-api/export/publications') {
      if (options.exportError) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 400, msg: '导出数据超过上限' }) })
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': "attachment; filename*=UTF-8''synthetic.xlsx" }, body: Buffer.from('synthetic-xlsx') })
    }
    if (/\/demand-api\/requests\/[^/]+\/assign$/.test(api)) {
      const id = api.split('/')[3]
      calls.push({ type: 'assign', id, body: route.request().postDataJSON() })
      if (options.failAssignId === id) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 409, msg: '需求已更新，请刷新后重试' }) })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
    }
    if (/\/demand-api\/requests\/[^/]+\/outcome$/.test(api)) {
      calls.push({ type: 'outcome', id: api.split('/')[3], body: route.request().postDataJSON() })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
    }
    if (/\/demand-api\/requests\/[^/]+\/publication\/auto$/.test(api)) {
      calls.push({ type: 'autoPublish', id: api.split('/')[3], body: route.request().postDataJSON() })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: { published: true, unchanged: false }, msg: null }) })
    }
    if (/\/demand-api\/requests\/[^/]+\/publication\/skip$/.test(api)) {
      calls.push({ type: 'skip', id: api.split('/')[3], body: route.request().postDataJSON() })
      detail.publicationSkipped = true
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: { changed: true, skipped: true }, msg: null }) })
    }
    if (/\/demand-api\/admin\/forms\/[^/]+\/void$/.test(api)) {
      calls.push({ type: 'void', key: api.split('/')[4], body: route.request().postDataJSON() })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
    }
    if (/\/demand-api\/admin\/forms\/[^/]+\/delete$/.test(api)) {
      calls.push({ type: 'deleteForm', key: api.split('/')[4] })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: { demandCount: 2, dataCount: 2 }, msg: null }) })
    }
    if (/\/demand-api\/admin\/forms\/[^/]+\/restore$/.test(api)) {
      calls.push({ type: 'restore', key: api.split('/')[4] })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
    }
    if (/\/demand-api\/admin\/forms\/[^/]+\/purge$/.test(api)) {
      calls.push({ type: 'purge', key: api.split('/')[4] })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: { purged: true }, msg: null }) })
    }
    if (/\/demand-api\/admin\/forms\/[^/]+\/department-members\/[^/]+$/.test(api)) {
      const key = api.split('/')[4]
      const deptKey = decodeURIComponent(api.split('/').pop())
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        calls.push({ type: 'departmentMember', key, deptKey, body })
        const meta = departments.find((d) => d.deptKey === deptKey) || { name: deptKey, memberCount: 0 }
        const row = {
          deptKey,
          name: meta.name,
          memberCount: meta.memberCount,
          canFill: !!body.canFill,
          canHandle: !!body.canHandle,
          canManage: !!body.canManage
        }
        const index = departmentGrants.findIndex((d) => d.deptKey === deptKey)
        if (index >= 0) departmentGrants[index] = row
        else departmentGrants.push(row)
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
      }
      if (route.request().method() === 'DELETE') {
        calls.push({ type: 'removeDepartmentMember', key, deptKey })
        departmentGrants = departmentGrants.filter((d) => d.deptKey !== deptKey)
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: null, msg: null }) })
      }
    }
    if (api === '/demand-api/admin/departments/import') {
      calls.push({ type: 'importDepartments', body: route.request().postDataJSON() })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: { departments: 2, memberships: 1, replaced: true }, msg: null }) })
    }
    let data = null
    if (api === '/demand-api/capabilities') data = { ...notices, admin: role === 'all' || role === 'assigned', global: role === 'all', handler: role !== 'ordinary', manage: role === 'all' || role === 'manager' || role === 'assigned' }
    else if (api === '/demand-api/forms') data = forms
    else if (api === '/demand-api/admin/forms') data = (role === 'assigned' ? forms.filter((f) => f.formKey === 'A') : forms).map((f) => ({ ...f, voided: options.voidedKey === f.formKey }))
    else if (api === '/demand-api/admin/forms/deleted') data = deletedForms
    else if (/^\/demand-api\/forms\/[^/]+\/handlers$/.test(api)) data = [{ userId: '30', name: '测试经办人' }]
    else if (/^\/demand-api\/forms\//.test(api)) data = { managed: true, allowAnonymous: api.endsWith('/A') }
    else if (api === '/demand-api/requests') {
      const formKey = url.searchParams.get('formKey')
      const aRows = [{ ...row, publicationPublished: !!options.publishedFirst }, rowA2]
      const rows = role === 'assigned'
        ? formKey === 'B' ? [] : aRows
        : formKey === 'A' ? aRows : formKey === 'B' ? [rowB] : [...aRows, rowB]
      data = { rows, total: rows.length }
    }
    else if (api === '/demand-api/requests/summary') {
      const scope = url.searchParams.get('scope')
      const canManage = role === 'all' || role === 'manager' || role === 'assigned'
      const all = [{ formKey: 'A', formName: '信息化需求征集', total: 2, unread: 1, pending: 1, lastUpdate: '2026-11-13 09:00:00', canManage }, { formKey: 'B', formName: '设备改善需求征集', total: 1, unread: 0, pending: 1, lastUpdate: '2026-11-12 09:00:00', canManage }]
      const pending = { ...all[0], unread: 0, pending: 2 }
      data = scope === 'pending' ? [pending] : role === 'assigned' ? [all[0]] : all
    }
    else if (api === '/demand-api/requests/demand-1') data = detail
    else if (api === '/demand-api/admin/forms/A/members') data = [{ userId: '30', name: '测试经办人', canHandle: true, canFill: true, canManage: true }]
    else if (api === '/demand-api/admin/departments') data = departments
    else if (/^\/demand-api\/admin\/forms\/[^/]+\/department-members$/.test(api)) data = api.includes('/A/') ? departmentGrants : []
    else if (api === '/demand-api/admin/users') data = [{ id: '30', name: '测试经办人' }]
    else if (api === '/demand-api/admin/roles') data = []
    else if (api === '/demand-api/lookup') data = { ...detail, canViewTable: false, canHandle: false, canAssign: false, canPublish: false }
    else if (api === '/demand-api/publications') data = [{ id: 'pub-1', title: '设备维护记录查询优化', summary: '已采纳设备维护历史查询建议，当前正在实施。', decision: 'ACCEPTED', progress: 'IN_PROGRESS', version: 1, unread: true, formKey: 'A', requestNo: 'REQ-20261113-TEST001', submitterName: '测试员工', handlerName: '测试经办人', createTime: '2026-11-13 09:00:00', formName: '信息化需求征集', updateTime: '2026-11-13 10:00:00' }, { id: 'pub-2', title: '车间照明分区控制', summary: '已采纳车间照明改善建议，等待排期。', decision: 'DEFERRED', progress: 'NONE', version: 1, unread: false, formKey: 'B', requestNo: 'REQ-20261113-TEST002', submitterName: '匿名', handlerName: '测试经办人', createTime: '2026-11-12 09:00:00', formName: '设备改善需求征集', updateTime: '2026-11-12 10:00:00' }]
    else if (api === '/demand-api/publications/pub-1') data = { id: 'pub-1', title: '设备维护记录查询优化', summary: '需求摘要', content: '已安排实施，完成后将更新进展。', version: 1, formKey: 'A', formName: '信息化需求征集', updateTime: '2026-11-13 10:00:00' }
    else if (api === '/demand-api/read') data = null
    else if (api === '/demand-api/requests/demand-1/messages') { const b = route.request().postDataJSON(); detail.messages.push({ id: 'reply-2', kind: b.kind, content: b.content, authorName: '测试经办人', createTime: '2026-11-13 11:00:00' }); data = null }
    else if (api === '/demand-api/requests/demand-1/outcome') { Object.assign(detail, route.request().postDataJSON()); data = null }
    else if (api === '/demand-api/requests/demand-1/assign' || api.endsWith('/publication')) data = null
    else if (api === '/public/systemInfoConfig') data = {}
    else if (api === '/user/form/setting-status') data = {}
    else if (/\/public\/settings\//.test(api)) data = {}
    else if (api.startsWith('/user/form/data/view/')) data = null
    else if (/\/user\/form\/details\//.test(api)) data = { form: { formKey: 'A', name: '测试收集单', type: 'ORDINARY' }, formItems: [], formItemList: [], theme: null }
    else data = {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data, msg: null }) })
  })
}
async function login(page) { await page.addInitScript(() => { localStorage.setItem('token', 'synthetic-session'); localStorage.setItem('userInfo', JSON.stringify({ name: '测试员工', admin: true })) }) }
async function noOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy() }

test('desktop homepage, permission union, collapse memory and badges', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await login(page); await mockApi(page); const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/demand/home'); await expect(page.getByRole('heading', { name: '首页', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: '信息化需求征集' })).toBeVisible()
  await expect(page.getByText('待我处理', { exact: false }).first()).toBeVisible(); await expect(page.getByText('后台管理', { exact: true })).toBeVisible(); await expect(page.locator('.nav-count').filter({ hasText: '5' })).toHaveCount(1)
  await expect(page.locator('#nprogress')).toHaveCount(0); await page.screenshot({ path: 'test-results/desktop-home.png', fullPage: true, animations: 'disabled' }); await page.getByRole('button', { name: '收缩或展开导航' }).click(); await expect(page.locator('.demand-shell')).toHaveClass(/collapsed/); await expect(page.locator('.collapsed-notice')).toHaveCount(3)
  await page.reload(); await expect(page.locator('.demand-shell')).toHaveClass(/collapsed/); await noOverflow(page); expect(errors).toEqual([])
})
test('ordinary user only sees own capabilities', async ({ page }) => {
  await login(page); await mockApi(page, 'ordinary'); await page.goto('/demand/home'); await expect(page.getByRole('heading', { name: '信息化需求征集' })).toBeVisible(); await expect(page.getByText('后台管理', { exact: true })).toHaveCount(0); await expect(page.getByText('待我处理', { exact: false })).toHaveCount(0)
})
test('mobile drawer closes after navigation and retains notification counts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page); await mockApi(page); await page.goto('/demand/home'); await expect(page.locator('.demand-sidebar')).not.toHaveClass(/mobile-open/)
  await page.getByRole('button', { name: '打开导航菜单' }).click(); await expect(page.locator('.demand-sidebar')).toHaveClass(/mobile-open/); await expect(page.locator('.nav-count').filter({ hasText: '5' })).toHaveCount(1); await expect(page.locator('.demand-sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); await page.screenshot({ path: 'test-results/mobile-menu.png', fullPage: true, animations: 'disabled' })
  await page.getByText('我的需求', { exact: false }).first().click(); await expect(page.locator('.demand-sidebar')).not.toHaveClass(/mobile-open/); await expect(page.getByRole('heading', { name: '我的需求', exact: true })).toBeVisible(); await noOverflow(page); await page.screenshot({ path: 'test-results/mobile-mine.png', fullPage: true, animations: 'disabled' })
})
test('opening request marks read, handler publishes result and reply', async ({ page }) => {
  await login(page); await mockApi(page); await page.goto('/demand/pending'); await expect(page.getByRole('heading', { name: '待我处理', exact: true })).toBeVisible(); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.getByRole('heading', { name: '信息化需求征集', exact: true })).toBeVisible(); await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.locator('.demand-detail-drawer')).toBeVisible(); await expect(page.getByRole('heading', { name: '采纳与实施' })).toBeVisible(); await page.getByPlaceholder('发布后填报者即可查看').fill('新的正式回复'); await page.getByRole('button', { name: '发布回复', exact: true }).click(); await expect(page.getByText('新的正式回复', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '发布处理结果', exact: true }).click(); await expect(page.getByText('处理结果已发布', { exact: true })).toBeVisible(); await noOverflow(page)
})
test('publication read only clears after opening detail', async ({ page }) => {
  await login(page); await mockApi(page); let reads = 0; page.on('request', req => { if (req.url().includes('/demand-api/read')) reads++ }); await page.goto('/demand/publications'); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); expect(reads).toBe(0); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.locator('.demand-list-desktop .request-title').filter({ hasText: '设备维护记录查询优化' })).toBeVisible(); expect(reads).toBe(0); await page.getByRole('button', { name: '查看公示' }).click(); await expect(page.getByText('已安排实施，完成后将更新进展。')).toBeVisible(); expect(reads).toBe(1)
})
test('pending toolbar does not overlap and tables show submit/reply times', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  let listUrl = ''; page.on('request', req => { if (req.url().includes('/demand-api/requests?') && !req.url().includes('/summary')) listUrl = req.url() })
  await page.goto('/demand/pending'); await expect(page.getByRole('heading', { name: '待我处理', exact: true })).toBeVisible(); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await expect(page.getByRole('columnheader', { name: '提报时间' })).toBeVisible(); await expect(page.getByRole('columnheader', { name: '回复时间' })).toBeVisible()
  const deskWidth = await page.locator('.demand-list-desktop .el-table__body-wrapper').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth })); expect(deskWidth.scroll).toBeLessThanOrEqual(deskWidth.client + 1)
  const overlaps = await page.locator('.demand-toolbar > *').evaluateAll(els => { const boxes = els.map(e => e.getBoundingClientRect()); let count = 0; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) count++ } return count })
  expect(overlaps).toBe(0); await noOverflow(page); await page.screenshot({ path: 'test-results/pending-toolbar-1024.png', fullPage: true, animations: 'disabled' })
  await page.evaluate(() => { document.querySelector('.demand-page').__vue__.submitRange = ['2026-11-01', '2026-11-30'] }); await page.getByRole('button', { name: '查询' }).click()
  await expect.poll(() => listUrl).toContain('submitStart=2026-11-01'); await expect.poll(() => listUrl).toContain('submitEnd=2026-11-30')
  await page.goto('/demand/publications'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); const table = page.locator('.demand-list-desktop')
  await expect(table.getByText('测试经办人', { exact: true })).toBeVisible(); await expect(table.getByText('测试员工', { exact: true })).toBeVisible(); await expect(page.getByRole('columnheader', { name: '提报时间' })).toBeVisible(); await expect(page.getByRole('columnheader', { name: '回复时间' })).toBeVisible()
  const pubWidth = await page.locator('.demand-list-desktop .el-table__body-wrapper').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth })); expect(pubWidth.scroll).toBeLessThanOrEqual(pubWidth.client + 1)
  await page.evaluate(() => { document.querySelector('.demand-page').__vue__.submitRange = ['2026-11-01', '2026-11-10'] }); await expect(table.locator('.request-title').filter({ hasText: '设备维护记录查询优化' })).toHaveCount(0)
  await page.evaluate(() => { document.querySelector('.demand-page').__vue__.submitRange = ['2026-11-01', '2026-11-30'] }); await expect(table.locator('.request-title').filter({ hasText: '设备维护记录查询优化' })).toBeVisible(); await noOverflow(page); await page.screenshot({ path: 'test-results/publications-table-1024.png', fullPage: true, animations: 'disabled' })
})
test('demand lists group by collection and drill down', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await login(page); await mockApi(page)
  await page.goto('/demand/mine'); await expect(page.getByRole('heading', { name: '我的需求', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await expect(page.locator('.form-overview')).toContainText('需求 2')
  await page.getByRole('button', { name: '进入设备改善需求征集' }).click(); await expect(page.getByRole('heading', { name: '设备改善需求征集', exact: true })).toBeVisible(); await expect(page.locator('.demand-list-desktop').getByText('车间照明改善')).toBeVisible(); await expect(page.getByText('优化设备维护记录查询')).toHaveCount(0)
  await page.getByRole('button', { name: '全部收集单' }).click(); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await page.setViewportSize({ width: 1024, height: 768 }); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await noOverflow(page); await page.screenshot({ path: 'test-results/desktop-groups.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/demand/publications'); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await page.getByPlaceholder('搜索收集单').fill('设备改善'); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toHaveCount(0)
  await page.getByRole('button', { name: '进入设备改善需求征集' }).click(); await expect(page.getByRole('heading', { name: '车间照明分区控制' })).toBeVisible(); await noOverflow(page); await page.screenshot({ path: 'test-results/mobile-publication-group.png', fullPage: true, animations: 'disabled' })
})
test('anonymous lookup requires code and never exposes handler controls', async ({ page }) => {
  await mockApi(page); await page.goto('/demand/lookup'); await page.getByPlaceholder('请输入需求编号').fill('REQ-20261113-TEST001'); await page.getByPlaceholder('请输入提交后领取的查询码').fill('synthetic-query-code'); await page.getByRole('button', { name: '查询回复与进度' }).click(); await expect(page.locator('.demand-detail-drawer')).toBeVisible(); await expect(page.getByRole('heading', { name: '采纳与实施' })).toHaveCount(0); await expect(page.getByText('已完成初步评估，目前正在实施。')).toBeVisible(); expect(page.url()).not.toContain('synthetic-query-code')
})
test('write defaults to login and anonymous mode is optional', async ({ page }) => {
  await mockApi(page); const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/s/A'); await expect(page.getByRole('button', { name: '登录并开始填写' })).toBeVisible(); await expect(page.getByText('匿名填写', { exact: true })).toBeVisible(); await expect(page.locator('.form-container')).toHaveCount(0); expect(errors).toEqual([])
  await page.getByText('匿名填写', { exact: true }).click(); await expect(page.getByRole('button', { name: '登录并开始填写' })).toHaveCount(0); await expect(page.getByText('本次匿名提交，不关联登录账户。提交后请保存查询码。')).toBeVisible()
})
test('login page only presents login and administrator configuration opens on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page); await mockApi(page); await page.goto('/login/entry'); await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible(); await expect(page.getByText(/Casdoor/i)).toHaveCount(0); await noOverflow(page)
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible(); await page.getByRole('button', { name: '收集配置' }).first().click(); await expect(page.getByText('允许匿名填写', { exact: true })).toBeVisible(); await noOverflow(page)
  await page.reload(); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible(); await page.getByRole('button', { name: '成员权限' }).first().click(); await expect(page.getByText('全选可填报', { exact: true }).first()).toBeVisible(); await noOverflow(page)
})
test('admin member drawer supports column select-all and one-click save', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  let saves = 0; page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/demand-api/admin/forms/A/members/30')) saves++ })
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible(); await page.getByRole('button', { name: '成员权限' }).first().click()
  const drawer = page.locator('.demand-detail-drawer'); await expect(drawer.locator('.member-row strong').first()).toHaveText('测试经办人')
  const fillAll = drawer.locator('.member-bulk-bar .el-checkbox').first(); const handleAll = drawer.locator('.member-bulk-bar .el-checkbox').nth(1)
  await expect(fillAll).toHaveClass(/is-checked/); await expect(handleAll).toHaveClass(/is-checked/)
  await fillAll.click(); await expect(fillAll).not.toHaveClass(/is-checked/); await expect(drawer.locator('.member-row .el-checkbox').first()).not.toHaveClass(/is-checked/)
  await fillAll.click(); await expect(fillAll).toHaveClass(/is-checked/)
  await drawer.getByRole('button', { name: '一键保存' }).first().click(); await expect(page.getByText('成员权限已保存', { exact: true })).toBeVisible(); expect(saves).toBe(1); await noOverflow(page); await page.screenshot({ path: 'test-results/admin-member-bulk.png', fullPage: true, animations: 'disabled' })
})
test('admin department grants display and reopen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible(); await page.getByRole('button', { name: '成员权限' }).first().click()
  const drawer = page.locator('.el-drawer').filter({ hasText: '成员与权限' })
  await drawer.locator('.el-tabs__item').filter({ hasText: '部门' }).click()
  const pane = drawer.locator('#pane-departments')
  const existing = pane.locator('.member-row').filter({ hasText: '技术部' }).first()
  await expect(existing).toBeVisible(); await expect(existing.locator('.el-checkbox').nth(2)).toHaveClass(/is-checked/)
  await page.evaluate(() => { const vm = document.querySelector('.demand-page').__vue__; vm.departmentKey = 'D2'; vm.addDepartment() })
  const added = pane.locator('.member-row').filter({ hasText: '研发组' }).first()
  await added.locator('.el-checkbox').first().click()
  await pane.getByRole('button', { name: '一键保存' }).click()
  await expect(page.getByText('部门权限已保存', { exact: true })).toBeVisible()
  const saved = calls.find((c) => c.type === 'departmentMember' && c.deptKey === 'D2')
  expect(saved && saved.body.canFill).toBeTruthy()
  await noOverflow(page); await page.screenshot({ path: 'test-results/admin-department-grants.png', fullPage: true, animations: 'disabled' })
  await page.locator('button[aria-label="close 成员与权限"]').click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '成员权限' }).first().click()
  const reopenedDrawer = page.locator('.el-drawer').filter({ hasText: '成员与权限' })
  await reopenedDrawer.locator('.el-tabs__item').filter({ hasText: '部门' }).click()
  const reopened = reopenedDrawer.locator('#pane-departments')
  const reopenedRow = reopened.locator('.member-row').filter({ hasText: '研发组' }).first()
  await reopenedRow.waitFor({ timeout: 10000 })
  await expect(reopenedRow.locator('.el-checkbox').first()).toHaveClass(/is-checked/)
})
test('admin voids a collection form', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible()
  const card = page.locator('.admin-form-list .demand-card').first()
  await card.getByRole('button', { name: '作废', exact: true }).click()
  await expect(page.getByText('作废收集单', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认作废', exact: true }).click()
  await expect.poll(() => calls.filter((c) => c.type === 'void')).toEqual([{ type: 'void', key: 'A', body: { voided: true } }])
  await expect(page.getByText('收集单已作废', { exact: true })).toBeVisible(); await noOverflow(page)
})
test('voided collection shows tag and can be restored', async ({ page }) => {
  await login(page); await mockApi(page, 'all', { voidedKey: 'A' })
  await page.goto('/demand/admin'); const card = page.locator('.admin-form-list .demand-card').first()
  await expect(card.getByText('已作废', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(page.getByText('恢复收集单', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认恢复', exact: true }).click()
  await expect.poll(() => calls.filter((c) => c.type === 'void')).toEqual([{ type: 'void', key: 'A', body: { voided: false } }])
  await expect(page.getByText('收集单已恢复', { exact: true })).toBeVisible()
})
test('global admin deletes a collection form and restores it from recycle', async ({ page }) => {
  await login(page); await mockApi(page)
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible()
  const card = page.locator('.admin-form-list .demand-card').first()
  await card.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText('删除收集单', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect.poll(() => calls.filter((c) => c.type === 'deleteForm')).toEqual([{ type: 'deleteForm', key: 'A' }])
  await expect(page.getByText('已移入回收站，需求与答卷已保留', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '全局回收站', exact: true }).click()
  const dialog = page.locator('.el-dialog').filter({ hasText: '全局回收站' })
  const row = dialog.locator('.el-table__row').filter({ hasText: '已删除收集单' })
  await expect(row).toContainText('2')
  await row.getByRole('button', { name: '恢复', exact: true }).click()
  await page.getByRole('button', { name: '确认恢复', exact: true }).click()
  await expect.poll(() => calls.filter((c) => c.type === 'restore')).toEqual([{ type: 'restore', key: 'D' }])
  await expect(page.getByText('收集单已恢复', { exact: true })).toBeVisible()
})
test('global recycle purges only empty collections', async ({ page }) => {
  await login(page); await mockApi(page)
  await page.goto('/demand/admin'); await page.getByRole('button', { name: '全局回收站', exact: true }).click()
  const dialog = page.locator('.el-dialog').filter({ hasText: '全局回收站' })
  const withDemands = dialog.locator('.el-table__row').filter({ hasText: '已删除收集单' })
  await expect(withDemands.getByRole('button', { name: '彻底删除', exact: true })).toHaveClass(/is-disabled/)
  const empty = dialog.locator('.el-table__row').filter({ hasText: '空收集单' })
  await empty.getByRole('button', { name: '彻底删除', exact: true }).click()
  const box = page.locator('.el-message-box')
  await box.locator('input').fill('空收集单')
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect.poll(() => calls.filter((c) => c.type === 'purge')).toEqual([{ type: 'purge', key: 'E' }])
  await expect(page.getByText('收集单已彻底删除', { exact: true })).toBeVisible()
})

test('small phone at 320px keeps navigation and detail within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await login(page); await mockApi(page); await page.goto('/demand/home'); await expect(page.getByRole('heading', { name: '信息化需求征集' })).toBeVisible(); await noOverflow(page)
  await page.getByRole('button', { name: '打开导航菜单' }).click(); await expect(page.locator('.demand-sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); expect((await page.locator('.demand-sidebar').boundingBox()).width).toBe(240)
  await page.getByText('我的需求', { exact: false }).first().click(); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await noOverflow(page); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await page.locator('.demand-list-mobile').getByRole('button', { name: '查看', exact: true }).first().click(); await expect(page.locator('.demand-detail-drawer')).toBeVisible(); await noOverflow(page)
  await page.goto('/demand/publications'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.locator('.demand-list-mobile .demand-card').first()).toContainText('测试经办人'); await expect(page.locator('.demand-list-mobile .demand-card').first()).toContainText('提报'); await noOverflow(page)
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.getByPlaceholder('提报开始')).toBeVisible(); await noOverflow(page); await page.screenshot({ path: 'test-results/mobile-pending-320.png', fullPage: true, animations: 'disabled' })
})

test('pending meta line stays single-line and rows keep compact height', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  const meta = page.locator('.demand-list-desktop .request-meta').nth(1)
  await expect(meta).toHaveAttribute('title', 'REQ-20261113-TEST003 · 信息化需求征集与设备改善需求联合征集（超长名称用于验证省略）')
  const style = await meta.evaluate(el => { const s = getComputedStyle(el); return { whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, scroll: el.scrollWidth, client: el.clientWidth } })
  expect(style.whiteSpace).toBe('nowrap'); expect(style.textOverflow).toBe('ellipsis'); expect(style.scroll).toBeGreaterThan(style.client)
  const heights = await page.locator('.demand-list-desktop .el-table__body tr').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height))
  expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1); await noOverflow(page)
})

test('desktop export downloads filtered xlsx for pending, publications and admin table', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page)
  const urls = []; page.on('request', req => { if (req.url().includes('/demand-api/export/')) urls.push(decodeURIComponent(req.url())) })
  const download = async name => { const event = page.waitForEvent('download'); await page.getByRole('button', { name }).click(); return event }
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await page.getByPlaceholder('搜索标题、编号或收集单').fill('设备')
  await page.evaluate(() => { document.querySelector('.demand-page').__vue__.submitRange = ['2026-11-01', '2026-11-30'] })
  let file = await download('导出 Excel'); expect(file.suggestedFilename()).toMatch(/^待我处理-\d{8}-\d{4}\.xlsx$/)
  expect(urls[urls.length - 1]).toContain('scope=pending'); expect(urls[urls.length - 1]).toContain('formKey=A'); expect(urls[urls.length - 1]).toContain('keyword=设备'); expect(urls[urls.length - 1]).toContain('submitStart=2026-11-01'); expect(urls[urls.length - 1]).not.toContain('page=')
  await page.goto('/demand/publications'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await page.getByPlaceholder('搜索公示标题或摘要').fill('设备')
  await page.evaluate(() => { document.querySelector('.demand-page').__vue__.submitRange = ['2026-11-01', '2026-11-30'] })
  file = await download('导出 Excel'); expect(file.suggestedFilename()).toMatch(/^需求公示-\d{8}-\d{4}\.xlsx$/)
  expect(urls[urls.length - 1]).toContain('/export/publications'); expect(urls[urls.length - 1]).toContain('formKey=A'); expect(urls[urls.length - 1]).toContain('keyword=设备')
  await page.goto('/demand/admin'); await page.getByText('需求总表与公示审核', { exact: true }).click()
  await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  file = await download('导出本收集单'); expect(file.suggestedFilename()).toMatch(/^需求总表-\d{8}-\d{4}\.xlsx$/)
  expect(urls[urls.length - 1]).toContain('scope=managed'); expect(urls[urls.length - 1]).toContain('formKey=A')
})

test('admin demand table groups by collection, drills down and returns', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page)
  await page.goto('/demand/admin'); await page.getByText('需求总表与公示审核', { exact: true }).click()
  await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await expect(page.locator('.form-overview')).toContainText('需求 2')
  await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.locator('.form-heading')).toHaveText('信息化需求征集')
  await expect(page.locator('.demand-list-desktop .request-title')).toHaveCount(2); await expect(page.getByRole('columnheader', { name: '提报时间' })).toBeVisible(); await noOverflow(page)
  await page.getByRole('button', { name: '全部收集单' }).click(); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await noOverflow(page)
  await page.screenshot({ path: 'test-results/admin-table-1024.png', fullPage: true, animations: 'disabled' })
})

test('assigned admin sees only manageable collections and no role grant', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'assigned')
  await page.goto('/demand/home'); await expect(page.getByText('后台管理', { exact: true })).toBeVisible()
  await page.goto('/demand/admin'); await expect(page.getByRole('heading', { name: '后台管理' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建收集单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '后台管理员授权' })).toHaveCount(0)
  await expect(page.locator('.admin-form-list .demand-card')).toHaveCount(1)
  await expect(page.locator('.admin-form-list')).toContainText('信息化需求征集')
  await expect(page.locator('.admin-form-list')).not.toContainText('设备改善需求征集')
  let exportUrl = ''
  page.on('request', req => { if (req.url().includes('/demand-api/export/requests')) exportUrl = decodeURIComponent(req.url()) })
  await page.getByText('需求总表与公示审核', { exact: true }).click()
  await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible()
  await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toHaveCount(0)
  await page.getByRole('button', { name: '导出全部' }).click()
  await expect.poll(() => exportUrl).toContain('scope=managed')
  await expect.poll(() => exportUrl).not.toContain('scope=table')
  await page.goto('/manage/user'); await expect(page).toHaveURL(/\/demand\/home$/)
  await page.goto('/project/form/data?key=A'); await expect(page).toHaveURL(/\/demand\/home$/)
})

test('assigned admin designer hides data and statistics', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'assigned')
  await page.goto('/project/form?key=A')
  const menu = page.locator('.custom-el-menu')
  await expect(menu).toContainText('编辑')
  await expect(menu.locator('.el-menu-item').filter({ hasText: '数据' })).toHaveCount(0)
  await expect(menu.locator('.el-menu-item').filter({ hasText: '统计' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存至模板中心' })).toHaveCount(0)
})

test('manager sees pending menu and can skip publication in detail', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager')
  await page.goto('/demand/home'); await expect(page.getByText('待我处理', { exact: false }).first()).toBeVisible(); await expect(page.getByText('后台管理', { exact: true })).toHaveCount(0)
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '采纳与实施' })).toBeVisible(); await expect(page.getByRole('heading', { name: '内部公示' })).toBeVisible()
  await page.getByRole('button', { name: '不公示', exact: true }).click(); await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByText('已记录为不公示', { exact: true })).toBeVisible()
  expect(calls.filter(c => c.type === 'skip').map(c => c.body.revision)).toEqual([1])
  await expect(page.getByText('该需求已标记为不公示；仍可在此重新发布公示。')).toBeVisible()
})

test('manual publication requires a formal reply first', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager', { noReply: true })
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '内部公示' })).toBeVisible()
  await page.getByRole('button', { name: '审核并发布公示' }).click()
  await expect(page.getByText('请先发布正式回复，再公示', { exact: true })).toBeVisible()
  await expect(page.getByText('公示已发布', { exact: true })).toHaveCount(0)
})

test('manager batch assign aggregates partial conflict without toast spam', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager', { failAssignId: 'demand-3' })
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await page.locator('.demand-list-desktop th .el-checkbox').first().click(); await expect(page.locator('.demand-batch-bar')).toContainText('已选 2 条')
  await page.getByRole('button', { name: '批量分派', exact: true }).click()
  const dialog = page.locator('.el-dialog').filter({ hasText: '批量分派' }); await expect(dialog).toBeVisible(); await dialog.locator('.el-select').click()
  await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '测试经办人' }).first().click()
  await dialog.getByRole('button', { name: '确认分派' }).click()
  await expect(page.locator('.el-dialog').filter({ hasText: '批量处理结果' })).toContainText('成功 1 条，失败 1 条'); await expect(page.getByText('需求已更新，请刷新后重试')).toBeVisible()
  expect(calls.filter(c => c.type === 'assign').map(c => c.body.revision).sort()).toEqual([1, 5]); expect(calls.filter(c => c.type === 'assign').every(c => c.body.handlerId === '30')).toBeTruthy()
  await expect(page.locator('.el-message--error')).toHaveCount(0)
})

test('manager batch publish skips published rows and batch skip uses per-row revision', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager', { publishedFirst: true })
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await page.locator('.demand-list-desktop th .el-checkbox').first().click(); await page.getByRole('button', { name: '批量公示', exact: true }).click(); await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByText('批量公示完成：成功 1 条，跳过 1 条')).toBeVisible(); expect(calls.filter(c => c.type === 'autoPublish').map(c => c.body.revision)).toEqual([5])
  await page.locator('.demand-list-desktop th .el-checkbox').first().click(); await page.getByRole('button', { name: '批量跳过公示', exact: true }).click(); await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByText('批量跳过公示完成：成功 1 条，跳过 1 条')).toBeVisible(); expect(calls.filter(c => c.type === 'skip').map(c => c.body.revision)).toEqual([5])
})

test('manager batch outcome applies one result with per-row revision', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager')
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click()
  await page.locator('.demand-list-desktop th .el-checkbox').first().click(); await page.getByRole('button', { name: '批量更新结果', exact: true }).click()
  const dialog = page.locator('.el-dialog').filter({ hasText: '批量更新结果' }); await dialog.locator('textarea').first().fill('批量采纳说明'); await dialog.getByRole('button', { name: '确认更新' }).click()
  await expect(page.getByText('批量更新结果完成：成功 2 条')).toBeVisible()
  const outcomes = calls.filter(c => c.type === 'outcome'); expect(outcomes.map(c => c.body.revision)).toEqual([1, 5]); expect(outcomes.every(c => c.body.decision === 'ACCEPTED' && c.body.reason === '批量采纳说明')).toBeTruthy()
})

test('member drawer manage checkbox blocks removing the last manager', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await login(page); await mockApi(page, 'all', { noDeptManager: true })
  let saves = 0; page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/admin/forms/A/members/')) saves++ })
  await page.goto('/demand/admin'); await page.getByRole('button', { name: '成员权限' }).first().click()
  const drawer = page.locator('.demand-detail-drawer'); await expect(drawer.getByText('全选可管理', { exact: true }).first()).toBeVisible(); await expect(drawer.getByText('可管理/可公示', { exact: true }).first()).toBeVisible()
  const manage = drawer.locator('.member-row .el-checkbox').nth(2); await expect(manage).toHaveClass(/is-checked/); await manage.click()
  await drawer.getByRole('button', { name: '一键保存' }).first().click(); await expect(page.getByText('每个收集单至少保留一名有效单据管理员', { exact: true })).toBeVisible(); expect(saves).toBe(0)
})

test('small screens keep export available and hide batch controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page); await mockApi(page, 'manager')
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.getByRole('button', { name: '导出 Excel' })).toBeVisible(); await expect(page.locator('.demand-batch-bar')).toHaveCount(0); await noOverflow(page)
  await page.setViewportSize({ width: 320, height: 740 }); await noOverflow(page); await page.screenshot({ path: 'test-results/mobile-pending-export-320.png', fullPage: true, animations: 'disabled' })
})

test('export failure shows one message and does not download', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page); await mockApi(page, 'manager', { exportError: true })
  let downloads = 0; page.on('download', () => downloads++)
  await page.goto('/demand/pending'); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await page.getByRole('button', { name: '导出 Excel' }).click()
  await expect(page.getByText('导出数据超过上限', { exact: true })).toBeVisible(); await page.waitForTimeout(300); expect(downloads).toBe(0)
})

// 品牌回归同时覆盖旧缓存与配置异步返回，防止标题恢复成旧名称。
test('company branding replaces cached defaults and supports custom names', async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => localStorage.setItem('systemConfig', JSON.stringify({systemName:'Tduck填鸭表单'})))
  await page.route(/\/public\/systemInfoConfig(?:\?|$)/, route => route.fulfill({contentType:'application/json', body:JSON.stringify({code:200,data:JSON.stringify({systemName:'Tduck填鸭表单'})})}))
  await page.goto('/login/entry')
  await expect(page.getByRole('heading', {name:'瑞玛问卷系统',exact:true})).toBeVisible()
  await expect(page).toHaveTitle(/瑞玛问卷系统/)
  await expect(page.locator('body')).not.toContainText(/Tduck|填鸭/i)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','/favicon.ico?v=20261114')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/apple-touch-icon.png?v=20261114')
  const logo = page.getByAltText('瑞玛公司标志'); await expect(logo).toBeVisible()
  expect(await logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy()
  await page.route(/\/public\/systemInfoConfig(?:\?|$)/, route => route.fulfill({contentType:'application/json', body:JSON.stringify({code:200,data:JSON.stringify({systemName:'设备改善问卷'})})}))
  await page.reload(); await expect(page).toHaveTitle(/设备改善问卷/)
  await page.goto('/missing/deep/page'); await expect(page.getByText('404',{exact:true}).first()).toBeVisible(); await expect(page.locator('.footer-text')).toHaveText('瑞玛问卷系统')
})
