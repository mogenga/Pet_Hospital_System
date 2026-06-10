# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

宠物医院诊疗与住院管理系统 — a pet hospital management system covering outpatient consultation, diagnosis & prescription, hospitalization & nursing, pharmacy inventory, pet boarding, and billing.

**Tech stack:** FastAPI + React 19 + TypeScript + PostgreSQL + Redis + MinIO.
Frontend: Vite + shadcn/ui + Tailwind CSS v4 + Zustand + TanStack React Query + React Router v7.
Backend: FastAPI + SQLAlchemy Async + Celery + python-jose (JWT).

**Current state:** 后端 10/10 阶段全部完成，前端 9 全部完成。所有功能模块已实现（auth / pharmacy / customer / consultation / billing / hospitalization / boarding / accounts / Celery PDF 导出 / Redis 缓存 / MinIO 文件上传）。PostgreSQL schema（`backend/sql/init_db.sql`）为数据权威源。

---

## Common Commands

### Frontend (`cd frontend`)

```bash
npm run dev          # 开发服务器 (localhost:5173)
npm run build        # TypeScript 编译 + Vite 构建
npm run lint         # ESLint 检查
npm run preview      # 预览生产构建
```

### Backend (`cd backend`)

```bash
conda activate PHS                                    # 激活虚拟环境
uvicorn app.main:app --reload --port 8000             # 开发服务器 (localhost:8000)
celery -A app.tasks.celery_app worker --loglevel=info # Celery Worker（PDF 导出）
python seed.py                                        # 种子数据
```

### Testing

```bash
cd backend
pytest tests/ -v                          # 所有测试
pytest tests/integration/test_auth.py -v  # 单个模块测试
pytest tests/ -v -k "test_login"          # 按名称筛选
pytest tests/ -v --tb=long                # 显示完整 traceback
```

### Database

```bash
psql -U postgres -c "CREATE DATABASE pet_hospital;"                    # 创建库
psql -U postgres -d pet_hospital -f backend/sql/init_db.sql            # 执行 DDL
cd backend && alembic stamp head                                       # 标记基线
cd backend && alembic revision --autogenerate -m "描述"                 # 生成迁移
cd backend && alembic upgrade head                                     # 应用迁移
```

### MinIO

```bash
docker compose up -d minio    # 启动 MinIO
# Console: http://localhost:9001 (创建 bucket，默认名 pet-hospital)
```

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/superpowers/specs/2026-05-01-system-architecture-design.md` | Full system architecture — component roles, auth flow, business flows, API design, project structure |
| `docs/superpowers/specs/2026-05-01-design-issues-resolutions.md` | 15 design issues found during review, each with problem description, alternatives considered, and chosen solution |
| `docs/数据库设计文档.md` | PostgreSQL schema — all 15 tables, 3NF rationale, views, constraints |
| `backend/sql/init_db.sql` | Executable DDL — the authoritative source of the database schema |
| `docs/superpowers/plans/2026-05-01-system-implementation-plan.md` | Step-by-step implementation plan with dependency order, file lists, and TDD test scenarios |
| `docs/superpowers/specs/2026-05-14-frontend-design.md` | 前端设计文档 — 色彩系统、布局、路由、状态管理、页面模式 |
| `backend/.env.example` | 后端环境变量模板 — PG/Redis/MinIO/JWT 配置项 |

---

## Backend Architecture

### Module Structure

Each business module in `backend/app/modules/<name>/` follows a 4-file convention:

| File | Role |
|------|------|
| `router.py` | API endpoints only — thin delegation to `service.py` |
| `service.py` | All business logic — validation, state transitions, transactions |
| `schemas.py` | Pydantic models (request/response shapes, validators) |
| `models.py` | SQLAlchemy ORM models (DB table definitions) |

**Modules:** `auth`, `customer`, `consultation`, `pharmacy`, `billing`, `hospitalization`, `boarding`, `minio_upload`.

**Shared layer** (`backend/app/shared/`): `pg_db.py` (async session), `redis.py` (Redis client), `minio.py` (S3-compatible upload), `services/billing_service.py` (single billing entry point).

**Tests** (`backend/tests/integration/`): One file per module using `pytest-asyncio` (`asyncio_mode = "auto"`). Test fixtures declare `async def` with `@pytest.fixture` markers. Use `httpx.AsyncClient` with FastAPI `TestClient` pattern.

### Critical Rules

- **Business logic in `service.py` only** — never in routers, never in database triggers.
- **No triggers.** Stock deduction uses `SELECT ... FOR UPDATE` row-level locking at the service layer. `CHECK` constraints exist only as a last-resort defense.
- **Visit status flow:** `待接诊 → 接诊中 → 待收费 → 已完成` (or `已取消`).
- **Hospitalization is independent** from visit status — check via `EXISTS (SELECT 1 FROM hospitalization WHERE visit_id=? AND status='住院中')`.
- **Billing entry point:** All bill/item creation goes through `shared/services/billing_service.py` (`ensure_bill` + `add_item`). Items are idempotent via `UNIQUE(bill_id, source_type, source_id)`.
- **Caching:** Cache-Aside pattern. Serialize via Pydantic schemas, never ORM objects. Keys: `customer:list`, `medicine:list`, `ward:status`, `employee:list`.
- **RBAC:** Three roles (管理员/医生/护士). Enforced via FastAPI dependencies `get_current_user` → `require_role(...)`. See spec section 7.3 for full permission matrix.

### Database from Code

`backend/app/shared/base.py` defines `DeclarativeBase`. All models inherit from it. SQLAlchemy `AsyncSession` uses `asyncpg` driver. Run `create_all` only for development — production uses Alembic migrations.

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── api/client.ts              # Axios 实例 — baseURL, 拦截器 (token 注入, 401→登出, 403→/403)
├── hooks/useApiHooks.ts       # TanStack React Query hooks — 一个文件包含所有模块的 hooks
├── types/index.ts             # 所有 TypeScript 类型定义 (API 请求/响应)
├── stores/authStore.ts        # Zustand + persist — 认证状态 (user, token, login/logout)
├── stores/workflowStore.ts    # Zustand — 就诊工作流步骤追踪
├── routes/index.tsx            # React Router v7 路由配置
├── components/layout/         # AppLayout, Sidebar, Topbar
├── components/common/          # ProtectedRoute, ConfirmDialog, StatusBadge, ImageUpload
├── components/ui/              # shadcn/ui 组件 (button, dialog, table, sidebar, badge…)
└── pages/                      # 页面组件 — 每模块一个列表页 + 详情页
```

### Data Flow Pattern

1. **API client** (`api/client.ts`): Centralized Axios instance with interceptors — auto-injects JWT from Zustand store, handles 401 (logout), 403 (redirect to `/403`), and generic error toasts via `sonner`.
2. **API hooks** (`hooks/useApiHooks.ts`): One hook per operation using TanStack React Query's `useQuery` / `useMutation`. Mutations auto-invalidate relevant query keys on success. Pattern:

   ```ts
   // useQuery — read
   export function useCustomers() {
     return useQuery<CustomerOut[]>({
       queryKey: ["customers"],
       queryFn: () => apiClient.get("/api/customers").then((r) => r.data),
       staleTime: 300000,  // 5 min
     });
   }
   // useMutation — write (auto-invalidates on success)
   export function useCreateCustomer() {
     const qc = useQueryClient();
     return useMutation({
       mutationFn: (data: CustomerCreate) =>
         apiClient.post("/api/customers", data).then((r) => r.data),
       onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
     });
   }
   ```

3. **Zustand stores**: `authStore` (persisted to localStorage, handles login/logout/role checks), `workflowStore` (ephemeral, tracks visit workflow step).

### Routing & Auth

Protected routes use `<ProtectedRoute>` wrapper which checks `useAuthStore.isAuthenticated()` and optionally `allowedRoles`. Failed auth → `/login`, failed role → `/403`. Routes are lazy-loaded via `createBrowserRouter`. Account management (`/accounts`) is admin-only.

### UI Conventions

- **shadcn/ui** components live in `src/components/ui/` — use existing components, add new ones via `shadcn` CLI.
- **Tailwind CSS v4** with `@theme inline` for design tokens (colors, radii, fonts).
- **OKLCH color space** for all colors — see `src/index.css` for the full palette.
- **Custom semantic colors:** `success` (green), `danger` (red), `info` (blue) — defined as CSS custom properties, available as Tailwind utilities.
- **Warm pet-themed palette:** Primary = warm orange (`oklch(0.72 0.18 51)`), sidebar = dark brown (`#3a2418`).
- **Utility classes:** `.pet-pattern` (dotted paw-print texture background), `.warm-card` (card with warm border/shadow).
- **Sonner** for toast notifications (top-right, `richColors`).
- **Font:** Geist Variable + Chinese fallbacks (PingFang SC, Microsoft YaHei, Noto Sans SC).

### Adding a New Page

1. Create page component under `src/pages/<module>/`
2. Add route in `src/routes/index.tsx` inside the `AppLayout` children array
3. Add breadcrumb entry in `src/components/layout/Topbar.tsx` → `breadcrumbMap`
4. Add sidebar menu item in `src/components/layout/Sidebar.tsx` → `menuItems`
5. Add API hooks in `src/hooks/useApiHooks.ts`
6. Add types in `src/types/index.ts`

---

## Environment Configuration

### Backend `.env` (from `.env.example`)

| Variable | Purpose |
|----------|---------|
| `PG_URL` | PostgreSQL async connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://...`) |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | MinIO S3-compatible storage |
| `JWT_SECRET` / `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES` | JWT auth configuration |
| `APP_ENV` / `APP_PORT` | Application environment |

### Frontend `.env` (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |

---

## Development Guidelines

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### 5. 语言规范

- Git 提交信息必须使用中文
- 代码中的注释必须使用中文
