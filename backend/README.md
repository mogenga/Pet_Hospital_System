# 宠物医院管理系统 — 后端

基于 FastAPI 的领域模块化单体后端，覆盖门诊接诊、诊断处方、住院护理、药品库存、宠物寄养、收费结算全流程。

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI (Python) + SQLAlchemy Async |
| 关系数据库 | PostgreSQL 15+ (15 表, 3NF) |
| 缓存 | Redis 7+ (Cache-Aside, TTL) |
| 对象存储 | MinIO (S3 兼容, Docker) |
| 任务队列 | Celery (Redis broker, PDF 导出) |
| PDF 生成 | ReportLab |

## 环境要求

- Python 3.10+（Conda 环境 `PHS`）
- PostgreSQL 15+
- Redis 7+
- MinIO（Docker）

## 快速开始

### 1. 创建 Conda 环境

```bash
conda create -n PHS python=3.12
conda activate PHS
```

### 2. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 中的数据库连接、JWT 密钥、MinIO 等配置
```

### 4. 数据库初始化

```sql
psql -U postgres -c "CREATE DATABASE pet_hospital;"
psql -U postgres -d pet_hospital -f sql/init_db.sql
```

`sql/init_db.sql` 是数据权威源，包含全部 15 张表和 `v_bill_total` 视图。

### 5. 种子数据

```bash
python seed.py
```

创建三个默认账号：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 医生 | doctor1 | test123456 |
| 护士 | nurse1 | test123456 |

### 6. 启动 MinIO

```bash
# 在项目根目录执行
docker compose up -d minio
```

访问 `http://localhost:9001` 登录，创建 bucket（默认 `pet-hospital`）。

### 7. 启动后端

```bash
uvicorn app.main:app --reload --port 8000
```

API 文档：`http://localhost:8000/docs`（Swagger UI）

### 8. Celery Worker（PDF 导出）

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

## 项目结构

```
backend/
├── app/
│   ├── main.py                  # FastAPI 入口, 路由注册, CORS, lifespan
│   ├── core/
│   │   ├── config.py            # 配置 (环境变量 → Pydantic Settings)
│   │   ├── security.py          # JWT 生成/校验, 密码哈希
│   │   ├── deps.py              # 依赖注入 (get_current_user, require_role)
│   │   └── exceptions.py        # 异常基类 + 全局异常处理器
│   ├── modules/                 # 业务模块 (领域模块化单体)
│   │   └── <name>/
│   │       ├── router.py        # API 路由
│   │       ├── service.py       # 业务逻辑
│   │       ├── schemas.py       # Pydantic 请求/响应模型
│   │       └── models.py        # SQLAlchemy ORM 模型
│   ├── shared/                  # 跨模块共享基础设施
│   │   ├── pg_db.py             # PostgreSQL 异步引擎 + 会话工厂
│   │   ├── redis.py             # Redis 客户端
│   │   └── services/
│   │       └── billing_service.py  # 统一账单收费入口
│   └── tasks/                   # Celery 异步任务
│       ├── celery_app.py        # Celery 实例配置
│       └── export_bill.py       # 账单 PDF 导出 + 上传 MinIO
├── sql/
│   └── init_db.sql              # DDL（15 张表, 数据权威源）
├── tests/
│   ├── conftest.py              # 测试夹具（async engine, test DB）
│   └── test_*.py                # 模块集成测试
└── seed.py                      # 种子数据脚本
```

## 业务模块

8 个模块，每个模块 5 文件结构（router + service + schemas + models + tests）：

| 模块 | 路由前缀 | 核心功能 |
|------|---------|---------|
| auth | `/api` | JWT 登录/登出/黑名单, 账号 CRUD（管理员） |
| customer | `/api/customers` | 客户 CRUD, 宠物 CRUD, 就诊历史聚合 |
| pharmacy | `/api/pharmacy` | 药品 CRUD, 批次入库, 库存预警, 行级锁扣减 |
| consultation | `/api/consultation` | 就诊登记→接诊→诊断→开方→取消, 状态流转 |
| billing | `/api/billing` | 账单自动生成, 收费项幂等, 结账, PDF 导出 |
| hospitalization | `/api/hospitalization` | 转入住院, 护理记录, 出院 |
| boarding | `/api/boarding` | 寄养登记, 结束寄养, 按天计费 |
| minio_upload | `/api/minio` | MinIO presigned PUT URL 直传 |

### API 速查

```
POST   /api/auth/login                    # 登录
POST   /api/auth/logout                   # 登出
GET    /api/auth/me                       # 当前用户信息
GET    /api/employees                     # 员工列表
GET    /api/accounts                      # 账号列表 [管理员]
POST   /api/accounts                      # 创建账号 [管理员]
PUT    /api/accounts/{id}                 # 启用/停用 [管理员]
DELETE /api/accounts/{id}                 # 删除账号 [管理员]

GET    /api/customers                     # 客户列表
GET    /api/customers/{id}                # 客户详情 + 宠物
POST   /api/customers                     # 新增客户 [管理员]
PUT    /api/customers/{id}                # 编辑客户 [管理员]
DELETE /api/customers/{id}                # 删除客户 [管理员]
POST   /api/customers/{id}/pets           # 添加宠物 [管理员]
PUT    /api/customers/{id}/pets/{pid}     # 编辑宠物 [管理员]
DELETE /api/customers/{id}/pets/{pid}     # 删除宠物 [管理员]
GET    /api/customers/{id}/history        # 就诊历史 [管理员/医生]

GET    /api/pharmacy/medicines            # 药品列表
POST   /api/pharmacy/medicines            # 新增药品 [管理员]
GET    /api/pharmacy/batches              # 批次列表 (支持 ?stock_qty_lt=)
POST   /api/pharmacy/batches              # 批次入库 [管理员]

GET    /api/consultation/visits           # 就诊列表 (支持 ?status=)
GET    /api/consultation/visits/{id}      # 就诊详情 (含诊断/处方)
POST   /api/consultation/visits           # 就诊登记 [管理员]
PUT    /api/consultation/visits/{id}/accept   # 接诊 [医生]
POST   /api/consultation/visits/{id}/diagnosis # 创建诊断 [医生]
POST   /api/consultation/diagnoses/{id}/prescriptions  # 开处方 [医生]
DELETE /api/consultation/visits/{id}      # 取消就诊 [管理员]

GET    /api/billing/bills                 # 账单列表
GET    /api/billing/bills/{id}            # 账单详情 + 收费项
POST   /api/billing/visits/{id}/items     # 添加收费项 [管理员/医生]
POST   /api/billing/bills/{id}/settle     # 结账 [管理员]
GET    /api/billing/bills/{id}/download   # 获取 PDF 下载链接

GET    /api/wards                         # 病床/笼位列表
POST   /api/hospitalization               # 转入住院 [管理员/医生]
GET    /api/hospitalization               # 住院列表 (支持 ?status=)
GET    /api/hospitalization/{id}          # 住院详情 + 护理记录
POST   /api/hospitalization/{id}/nursing  # 添加护理记录
PUT    /api/hospitalization/{id}/discharge # 出院 [管理员]

POST   /api/boarding                      # 登记寄养
GET    /api/boarding                      # 寄养列表
GET    /api/boarding/{id}                 # 寄养详情 (含动态计费)
PUT    /api/boarding/{id}/end             # 结束寄养

POST   /api/minio/upload-url              # 获取 MinIO 直传 URL
```

## 运行测试

```bash
cd backend
pytest -v
```

测试使用独立数据库，在 `conftest.py` 中配置。每个模块的集成测试遵循 TDD 流程：先写测试确认 FAIL → 实现功能 → 验证 PASS。

## 架构约定

- **业务逻辑在 service.py**，不在 router 和数据库触发器中
- **库存扣减**通过 service 层 `SELECT ... FOR UPDATE` 行级锁，数据库无触发器
- **账单收费**统一走 `shared/services/billing_service.py`（`ensure_bill` + `add_item`），收费项通过 `UNIQUE(bill_id, source_type, source_id)` 保证幂等
- **缓存**采用 Cache-Aside 模式，缓存值通过 Pydantic schema 序列化，不直接缓存 ORM 对象
- **角色权限**：管理员 / 医生 / 护士，后端通过 `require_role(...)` FastAPI dependency 强制校验

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PG_URL` | PostgreSQL 连接串 (asyncpg) | — |
| `REDIS_URL` | Redis 连接串 | — |
| `MINIO_ENDPOINT` | MinIO 服务地址 | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 密钥 | `minioadmin` |
| `MINIO_BUCKET` | MinIO bucket 名称 | `pet-hospital` |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `JWT_EXPIRE_MINUTES` | JWT 过期时间 (分钟) | `480` |
| `APP_ENV` | 运行环境 | `development` |
