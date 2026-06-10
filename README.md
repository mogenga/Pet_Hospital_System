# 宠物医院诊疗与住院管理系统

宠物医院业务管理系统，覆盖门诊接诊、诊断处方、住院护理、药品库存、宠物寄养、收费结算全流程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python) + SQLAlchemy Async |
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件 | shadcn/ui + Tailwind CSS v4 |
| 状态管理 | Zustand + TanStack React Query |
| 关系数据库 | PostgreSQL (15 表, 3NF) |
| 缓存 | Redis (Cache-Aside, TTL) |
| 对象存储 | MinIO (S3 兼容) |
| 任务队列 | Celery (Redis broker, PDF 导出) |

## 功能模块

| 模块 | 说明 |
|------|------|
| 用户认证 | JWT 登录/登出/密码修改，管理员/医生/护士三角色权限 |
| 客户管理 | 宠物主人信息管理、宠物档案、就诊历史 |
| 药品库存 | 药品 CRUD、批次管理、库存扣减 (行级锁) |
| 门诊接诊 | 就诊登记 → 接诊 → 诊断 → 开方 → 收费，完整状态流转 |
| 收费结算 | 自动生成账单、收费项汇总、PDF 导出、MinIO 归档 |
| 住院管理 | 住院/出院、护理记录、病床状态管理 |
| 宠物寄养 | 寄养登记/结束、按天计费、笼位状态管理 |
| 看板 | 角色差异化首页看板 |

## 快速开始

### 环境要求

- Python 3.10+ (Conda 环境 `PHS`)
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- MinIO (Docker)

### 1. 克隆项目

```bash
git clone <repo-url>
cd Pet_Hospital_System
```

### 2. 数据库初始化

```sql
psql -U postgres -c "CREATE DATABASE pet_hospital;"
psql -U postgres -d pet_hospital -f backend/sql/init_db.sql
```

### 3. 后端启动

```bash
cd backend
conda activate PHS
cp .env.example .env      # 编辑数据库连接等配置
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. 种子数据（可选）

```bash
cd backend
python seed.py
```

默认账号：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 医生 | doctor1 | test123456 |
| 护士 | nurse1 | test123456 |

### 5. MinIO 启动

```bash
docker compose up -d minio
# 访问 http://localhost:9001 创建 bucket (默认 pet-hospital)
```

### 6. 前端启动

```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 7. Celery Worker（PDF 导出）

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

## 项目结构

```
Pet_Hospital_System/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── core/                # 配置、安全、依赖注入
│   │   ├── modules/             # 业务模块 (auth/customer/pharmacy/...)
│   │   │   └── <name>/
│   │   │       ├── router.py    # API 路由
│   │   │       ├── service.py   # 业务逻辑
│   │   │       ├── schemas.py   # Pydantic 模型
│   │   │       └── models.py    # SQLAlchemy 模型
│   │   ├── shared/              # 跨模块共享 (MinIO, billing)
│   │   └── tasks/               # Celery 任务
│   ├── sql/
│   │   └── init_db.sql          # DDL（数据权威源）
│   └── seed.py                  # 种子数据脚本
├── frontend/
│   └── src/
│       ├── api/                 # Axios 客户端 + API hooks
│       ├── components/          # 布局 + 通用组件
│       ├── pages/               # 页面组件 (按模块分目录)
│       ├── stores/              # Zustand stores (auth, workflow)
│       └── types/               # TypeScript 类型定义
└── docs/                        # 设计文档、架构规范
```

## 文档索引

| 文档 | 说明 |
|------|------|
| `docs/superpowers/specs/2026-05-01-system-architecture-design.md` | 系统架构设计 |
| `docs/数据库设计文档.md` | 数据库表结构与约束 |
| `docs/superpowers/plans/2026-05-01-system-implementation-plan.md` | 分阶段实施计划 |
| `CLAUDE.md` | AI 辅助开发指南 |
