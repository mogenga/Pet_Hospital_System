# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

宠物医院诊疗与住院管理系统 — a pet hospital management system covering outpatient consultation, diagnosis & prescription, hospitalization & nursing, pharmacy inventory, pet boarding, and billing.

**Tech stack:** FastAPI + React + PostgreSQL + Redis + MinIO + MongoDB (see `docs/superpowers/specs/2026-05-01-system-architecture-design.md` for full architecture).

**Current state:** Design phase complete. No backend/frontend code yet. The database SQL (`pet_hospital_pg.sql`) and design docs are the ground truth.

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/superpowers/specs/2026-05-01-system-architecture-design.md` | Full system architecture — component roles, auth flow, business flows, API design, project structure |
| `docs/superpowers/specs/2026-05-01-design-issues-resolutions.md` | 15 design issues found during review, each with problem description, alternatives considered, and chosen solution |
| `docs/数据库设计文档.md` | PostgreSQL schema — all 15 tables, 3NF rationale, views, constraints |
| `pet_hospital_pg.sql` | Executable DDL — the authoritative source of the database schema |
| `docs/superpowers/plans/2026-05-01-system-implementation-plan.md` | Step-by-step implementation plan with dependency order, file lists, and TDD test scenarios |

---

## Architecture Conventions

**Backend (domain-modular monolith):** Each business module in `backend/app/modules/<name>/` has 5 files: `router.py`, `service.py`, `schemas.py`, `models.py`, plus tests. Business logic lives in `service.py` (not in routers, not in database triggers). Cross-module shared logic goes in `backend/app/shared/services/`.

**Database:** No triggers. Stock deduction is handled at the service layer with `SELECT ... FOR UPDATE` row-level locking. `CHECK` constraints exist only as a last-resort defense.

**State machines:** `visit.status` (`待接诊→接诊中→待收费→已完成` / `已取消`) and `hospitalization.status` (`住院中→已出院`) are independent — hospitalization does NOT overwrite visit status. Check hospitalization via `EXISTS (SELECT 1 FROM hospitalization WHERE visit_id=? AND status='住院中')`.

**Billing:** All bill/item creation goes through `shared/services/billing_service.py` (single `ensure_bill` + `add_item` entry point). Bill items are idempotent via `UNIQUE(bill_id, source_type, source_id)`.

**Caching:** Cache-Aside pattern. Serialize/deserialize cache values through Pydantic schemas, never SQLAlchemy ORM objects directly. Keys: `customer:list`, `medicine:list`, `ward:status`, `employee:list`.

**Role-based access:** Three roles (管理员/医生/护士). See spec section 7.3 for the full permission matrix. Backend enforces via FastAPI dependencies `get_current_user` → `require_role(...)`.

---

## Implementation Order

```
scaffold → infra → auth → pharmacy → customer → consultation → billing → hospitalization → boarding → frontend → export
```

`pharmacy` must be built before `consultation` because prescription creation calls `deduct_stock`. `auth → customer → consultation → billing` is the critical dependency chain.

**TDD required:** Each module writes integration tests first (verify FAIL), then implementation (verify PASS). The plan lists 15 mandatory test scenarios.

---

## Database Notes

- 15 tables, all in 3NF. Execute `pet_hospital_pg.sql` to bootstrap.
- After initial setup: `alembic stamp head` to mark the baseline, then `alembic revision --autogenerate` for future schema changes.
- All IDs are `SERIAL` surrogate keys.
- `v_bill_total` view replaces the deprecated `bill.total_amount` column.
- `medicine_batch.stock_qty` COMMENT says "由后端 service 层控制扣减"。**禁止加回触发器**——移除原因详见 `docs/superpowers/specs/2026-05-01-design-issues-resolutions.md` 问题三。

---

## Environment Notes

- `.env` 不入库，`.env.example` 作为模板入库
- MinIO 用 Docker（`docker compose up -d minio`），PG / Redis / MongoDB 用本地服务
- 前端 `localhost:5173`，后端 `localhost:8000`

---

## 开发规范

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
