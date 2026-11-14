const { test, expect } = require('@playwright/test')
const path = require('path')
const notices = { enabled: true, admin: true, handler: true, mineUnread: 2, pending: 5, publicationUnread: 3 }
const forms = [
  { formKey: 'A', name: '信息化需求征集', summary: '征集业务系统优化、报表改进与工作流程建议。', status: 2, published: true, visibility: 'LOGIN', allowAnonymous: true, revision: 0 },
  { formKey: 'B', name: '设备改善需求征集', summary: '提交设备维护、现场改善和安全优化需求。', status: 2, published: true, visibility: 'LOGIN', allowAnonymous: false, revision: 0 }
]
const row = { id: 'demand-1', title: '优化设备维护记录查询', requestNo: 'REQ-20261113-TEST001', formKey: 'A', formName: '信息化需求征集', submitterName: '测试员工', handlerId: '30', handlerName: '测试经办人', decision: 'ACCEPTED', progress: 'IN_PROGRESS', unread: true, revision: 1, publicVersion: 3, createTime: '2026-11-13 09:00:00' }
const rowB = { ...row, id: 'demand-2', title: '车间照明改善', requestNo: 'REQ-20261113-TEST002', formKey: 'B', formName: '设备改善需求征集', unread: false }
let detail
function makeDetail() { return { ...row, canViewTable: true, canHandle: true, canAssign: true, originalData: { title: row.title, description: '希望能按设备编号查询维护历史，减少重复查找。' }, formFields: [{ value: 'title', label: '需求标题' }, { value: 'description', label: '需求说明' }], reason: '采纳，已安排实施。', completion: '', messages: [{ id: 'reply-1', kind: 'REPLY', authorName: '测试经办人', content: '已完成初步评估，目前正在实施。', createTime: '2026-11-13 10:00:00' }], publication: null } }
async function mockApi(page, role = 'all') {
  detail = makeDetail()
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue()
    const api = url.pathname.replace(/^\/tduck-api/, '')
    if (!url.pathname.includes('tduck-api') && !api.startsWith('/demand-api/') && !api.startsWith('/auth/') && !api.startsWith('/user/')) return route.continue()
    let data = null
    if (api === '/demand-api/capabilities') data = { ...notices, admin: role === 'all', handler: role !== 'ordinary' }
    else if (api === '/demand-api/forms' || api === '/demand-api/admin/forms') data = forms
    else if (/^\/demand-api\/forms\//.test(api)) data = { managed: true, allowAnonymous: api.endsWith('/A') }
    else if (api === '/demand-api/requests') { const formKey = url.searchParams.get('formKey'); const rows = formKey === 'A' ? [row] : formKey === 'B' ? [rowB] : [row, rowB]; data = { rows, total: rows.length } }
    else if (api === '/demand-api/requests/summary') { const scope = url.searchParams.get('scope'); data = scope === 'pending' ? [{ formKey: 'A', formName: '信息化需求征集', total: 1, unread: 0, pending: 1, lastUpdate: '2026-11-13 09:00:00' }] : [{ formKey: 'A', formName: '信息化需求征集', total: 1, unread: 1, pending: 0, lastUpdate: '2026-11-13 09:00:00' }, { formKey: 'B', formName: '设备改善需求征集', total: 1, unread: 0, pending: 1, lastUpdate: '2026-11-12 09:00:00' }] }
    else if (api === '/demand-api/requests/demand-1') data = detail
    else if (api === '/demand-api/admin/forms/A/members') data = [{ userId: '30', name: '测试经办人', canHandle: true, canFill: true }]
    else if (api === '/demand-api/admin/users') data = [{ id: '30', name: '测试经办人' }]
    else if (api === '/demand-api/admin/roles') data = []
    else if (api === '/demand-api/lookup') data = { ...detail, canViewTable: false, canHandle: false, canAssign: false }
    else if (api === '/demand-api/publications') data = [{ id: 'pub-1', title: '设备维护记录查询优化', summary: '已采纳设备维护历史查询建议，当前正在实施。', decision: 'ACCEPTED', progress: 'IN_PROGRESS', version: 1, unread: true, formKey: 'A', formName: '信息化需求征集', updateTime: '2026-11-13 10:00:00' }, { id: 'pub-2', title: '车间照明分区控制', summary: '已采纳车间照明改善建议，等待排期。', decision: 'DEFERRED', progress: 'NONE', version: 1, unread: false, formKey: 'B', formName: '设备改善需求征集', updateTime: '2026-11-12 10:00:00' }]
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
  await login(page); await mockApi(page); let reads = 0; page.on('request', req => { if (req.url().includes('/demand-api/read')) reads++ }); await page.goto('/demand/publications'); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); expect(reads).toBe(0); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await expect(page.getByRole('heading', { name: '设备维护记录查询优化' })).toBeVisible(); expect(reads).toBe(0); await page.getByRole('button', { name: '查看公示' }).click(); await expect(page.getByText('已安排实施，完成后将更新进展。')).toBeVisible(); expect(reads).toBe(1)
})
test('demand lists group by collection and drill down', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await login(page); await mockApi(page)
  await page.goto('/demand/mine'); await expect(page.getByRole('heading', { name: '我的需求', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await expect(page.getByRole('button', { name: '进入设备改善需求征集' })).toBeVisible(); await expect(page.locator('.form-overview')).toContainText('需求 1')
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
})

test('small phone at 320px keeps navigation and detail within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await login(page); await mockApi(page); await page.goto('/demand/home'); await expect(page.getByRole('heading', { name: '信息化需求征集' })).toBeVisible(); await noOverflow(page)
  await page.getByRole('button', { name: '打开导航菜单' }).click(); await expect(page.locator('.demand-sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); expect((await page.locator('.demand-sidebar').boundingBox()).width).toBe(240)
  await page.getByText('我的需求', { exact: false }).first().click(); await expect(page.getByRole('button', { name: '进入信息化需求征集' })).toBeVisible(); await noOverflow(page); await page.getByRole('button', { name: '进入信息化需求征集' }).click(); await page.locator('.demand-list-mobile').getByRole('button', { name: '查看', exact: true }).first().click(); await expect(page.locator('.demand-detail-drawer')).toBeVisible(); await noOverflow(page)
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
