# 宠物医院管理系统 — 前端

基于 React 19 + TypeScript + Vite 构建的宠物医院管理 SPA 前端。

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| UI 组件 | shadcn/ui + Tailwind CSS v4 |
| 状态管理 | Zustand (auth/workflow) + TanStack React Query (服务端状态) |
| 路由 | React Router v7 |
| 动画 | Framer Motion |
| 表单 | React Hook Form + Zod |
| HTTP | Axios (拦截器注入 token + 401/403 处理) |
| 图标 | lucide-react |
| Toast | Sonner |

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:5173
```

后端 API 默认连接到 `http://localhost:8000`，可通过环境变量 `VITE_API_BASE_URL` 覆盖。

### 3. 构建生产版本

```bash
npm run build     # tsc 类型检查 + Vite 构建
npm run preview   # 预览构建产物
```

### 4. 代码检查

```bash
npm run lint
```

## 项目结构

```
frontend/
├── src/
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # QueryClient + Router + Toast 挂载
│   ├── api/
│   │   └── client.ts           # Axios 实例 (Base URL, 拦截器, 401/403)
│   ├── types/
│   │   └── index.ts            # 全部 TypeScript 类型定义
│   ├── stores/
│   │   ├── authStore.ts        # Zustand (JWT, user, login/logout, 持久化)
│   │   └── workflowStore.ts    # Zustand (咨询就诊工作流状态)
│   ├── hooks/
│   │   └── useApiHooks.ts      # 全部 React Query hooks (38 个)
│   ├── routes/
│   │   └── index.tsx           # 路由配置 (14 条路由)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 组件 (18 个)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx   # 整体布局 (Sidebar + Topbar)
│   │   │   ├── Sidebar.tsx     # 侧边导航栏
│   │   │   └── Topbar.tsx      # 顶部栏 (面包屑 + 用户菜单)
│   │   └── common/
│   │       ├── ProtectedRoute.tsx  # 路由守卫 (token + 角色检查)
│   │       ├── ConfirmDialog.tsx   # 通用确认对话框
│   │       ├── StatusBadge.tsx     # 状态标签 (彩色)
│   │       └── PetMascots.tsx      # 猫狗动画元素
│   └── pages/                  # 页面组件 (按模块分目录)
│       ├── Login.tsx
│       ├── Dashboard.tsx       # 三角色差异化看板
│       ├── customers/
│       │   ├── CustomerList.tsx
│       │   └── CustomerDetail.tsx   # 客户详情 + 宠物 CRUD + 就诊历史
│       ├── consultation/
│       │   ├── ConsultationList.tsx
│       │   └── ConsultationDetail.tsx  # 就诊工作流 (接诊→诊断→开方)
│       ├── pharmacy/
│       │   └── PharmacyList.tsx     # 药品列表 + 批次库存 + 入库
│       ├── billing/
│       │   ├── BillingList.tsx
│       │   └── BillingDetail.tsx    # 账单详情 + 收费项 + 结账 + PDF
│       ├── hospitalization/
│       │   ├── HospList.tsx
│       │   └── HospDetail.tsx       # 住院详情 + 护理记录
│       ├── boarding/
│       │   ├── BoardingList.tsx
│       │   └── BoardingDetail.tsx
│       └── accounts/
│           └── AccountList.tsx      # 账号管理 [管理员]
└── package.json
```

## 路由设计

共 14 条路由，所有业务路由在 `AppLayout` 内嵌套渲染：

| 路径 | 页面 | 权限 |
|------|------|------|
| `/login` | 登录页 | 公开 |
| `/dashboard` | 看板 | 登录用户 |
| `/customers` | 客户列表 | 登录用户 |
| `/customers/:id` | 客户详情 | 登录用户 |
| `/consultation` | 就诊列表 | 登录用户 |
| `/consultation/:id` | 就诊详情 | 登录用户 |
| `/pharmacy` | 药品库存 | 登录用户 |
| `/billing` | 账单列表 | 登录用户 |
| `/billing/:id` | 账单详情 | 登录用户 |
| `/hospitalization` | 住院列表 | 登录用户 |
| `/hospitalization/:id` | 住院详情 | 登录用户 |
| `/boarding` | 寄养列表 | 登录用户 |
| `/boarding/:id` | 寄养详情 | 登录用户 |
| `/accounts` | 账号管理 | 管理员 |

`/403` 为权限不足页，`*` 为 404 页。

## 页面组件（14 个）

| 页面 | 文件 | 说明 |
|------|------|------|
| 登录 | `Login.tsx` | 用户名/密码登录, 猫狗动画背景 |
| 看板 | `Dashboard.tsx` | 三角色差异化 (管理员/医生/护士), 今日统计 + 待办列表 |
| 客户列表 | `CustomerList.tsx` | 搜索/新增/编辑/删除客户 |
| 客户详情 | `CustomerDetail.tsx` | 客户信息, 宠物 CRUD 内嵌, 就诊历史时间线 |
| 就诊列表 | `ConsultationList.tsx` | 状态筛选, 接诊工作流入口 |
| 就诊详情 | `ConsultationDetail.tsx` | 状态流转 (待接诊→接诊中→已取消→待收费→已完成), 诊断 → 处方 |
| 药品库存 | `PharmacyList.tsx` | 药品 CRUD + 批次入库 + 低库存预警 |
| 账单列表 | `BillingList.tsx` | 账单列表, 状态筛选 |
| 账单详情 | `BillingDetail.tsx` | 收费项明细, 结账, PDF 下载 |
| 住院列表 | `HospList.tsx` | 住院筛选, 新建住院 |
| 住院详情 | `HospDetail.tsx` | 护理记录列表 + 新增 + 出院 |
| 寄养列表 | `BoardingList.tsx` | 寄养登记, 笼位选择 |
| 寄养详情 | `BoardingDetail.tsx` | 动态计费, 结束寄养 |
| 账号管理 | `AccountList.tsx` | 账号 CRUD + 启用/停用 [管理员] |

## 状态管理

**Zustand**（客户端持久化状态）：
- `authStore` — JWT token + 用户信息, 持久化至 `localStorage`, 提供 `login` / `logout` / `hasRole`
- `workflowStore` — 就诊流程步骤控制

**TanStack React Query**（服务端缓存状态）：
- `useApiHooks.ts` — 38 个 hooks，按模块分组
- 查询缓存策略：`staleTime` 按类型设置（就诊 1min / 账单 2min / 客户 5min / 药品 10min）
- 变更后自动 `invalidateQueries` 刷新列表

## 主题与样式

- 主色调：暖橙色 `#F97316`（`--primary`）
- Tailwind CSS v4 + `tw-animate-css` 动画
- shadcn/ui 组件通过 `components/ui/` 按需引入（18 个组件）
- 布局组件使用 `Card` + `warm-card` 类名保持统一风格
- 图标统一使用 `lucide-react`
- 角色识别：看板差异化、Sidebar 显示用户角色标签
- 猫狗动画元素 `PetMascots` 散布于看板等关键页面

## 认证流程

1. 用户登录 → `authStore.login()` → POST `/api/auth/login` → 存储 token + user
2. Axios 请求拦截器自动注入 `Authorization: Bearer <token>`
3. 401 响应 → 自动登出 → 跳转到 `/login`
4. 403 响应 → 跳转到 `/403` 权限不足页
5. 路由守卫 `ProtectedRoute` 双重检查：token 存在 + 角色匹配
