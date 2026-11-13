export default [
  {
    path: '/demand',
    component: () => import('@/views/demand/Shell'),
    redirect: '/demand/home',
    children: [
      { path: 'home', component: () => import('@/views/demand/Collections'), meta: { title: '首页' } },
      { path: 'forms', component: () => import('@/views/demand/Collections'), meta: { title: '需求收集' } },
      {
        path: 'mine',
        component: () => import('@/views/demand/Requests'),
        meta: { requireLogin: true, title: '我的需求' }
      },
      {
        path: 'pending',
        component: () => import('@/views/demand/Requests'),
        meta: { requireLogin: true, title: '待我处理' }
      },
      {
        path: 'publications',
        component: () => import('@/views/demand/Publications'),
        meta: { requireLogin: true, title: '需求公示' }
      },
      {
        path: 'admin',
        component: () => import('@/views/demand/Admin'),
        meta: { requireLogin: true, title: '后台管理' }
      },
      {
        path: 'lookup',
        name: 'DemandLookup',
        component: () => import('@/views/demand/Lookup'),
        meta: { title: '匿名需求查询' }
      }
    ]
  },
  { path: '/login/entry', component: () => import('@/views/demand/Login'), meta: { title: '登录' } },
  { path: '/login/callback', component: () => import('@/views/demand/LoginCallback'), meta: { title: '登录中' } }
]
