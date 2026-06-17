import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Conflict, NotFound
from app.modules.customer.schemas import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    PetCreate,
    PetOut,
    PetUpdate,
)
from app.shared.redis import redis_client

CACHE_KEY = "customer:list"
CACHE_TTL = 600  # 10 分钟


async def _invalidate_cache():
    await redis_client.delete(CACHE_KEY)


async def list_customers(db: AsyncSession) -> list[CustomerOut]:
    cached = await redis_client.get(CACHE_KEY)
    if cached:
        items = json.loads(cached)
        return [CustomerOut.model_validate(item) for item in items]

    result = await db.execute(
        text("SELECT customer_id, name, phone, address FROM customer ORDER BY customer_id")
    )
    customer_rows = result.fetchall()
    if not customer_rows:
        return []

    # 批量查询所有宠物，消除 N+1
    customer_ids = [row.customer_id for row in customer_rows]
    pet_result = await db.execute(
        text(
            "SELECT pet_id, customer_id, name, species, breed, birth_date, photo_key "
            "FROM pet WHERE customer_id = ANY(:cids) ORDER BY pet_id"
        ),
        {"cids": customer_ids},
    )
    pets_by_customer: dict[int, list] = {}
    for p in pet_result.fetchall():
        pets_by_customer.setdefault(p.customer_id, []).append(
            PetOut.model_validate(p._mapping)
        )

    customers = [
        CustomerOut(
            customer_id=row.customer_id,
            name=row.name,
            phone=row.phone,
            address=row.address,
            pets=pets_by_customer.get(row.customer_id, []),
        )
        for row in customer_rows
    ]

    data = [c.model_dump(mode="json") for c in customers]
    await redis_client.set(CACHE_KEY, json.dumps(data, ensure_ascii=False), ex=CACHE_TTL)
    return customers


async def get_customer(db: AsyncSession, customer_id: int) -> CustomerOut:
    result = await db.execute(
        text("SELECT customer_id, name, phone, address FROM customer WHERE customer_id = :id"),
        {"id": customer_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="客户不存在")

    pet_result = await db.execute(
        text(
            "SELECT pet_id, customer_id, name, species, breed, birth_date, photo_key "
            "FROM pet WHERE customer_id = :cid ORDER BY pet_id"
        ),
        {"cid": customer_id},
    )
    pets = [PetOut.model_validate(p._mapping) for p in pet_result.fetchall()]
    return CustomerOut(
        customer_id=row.customer_id,
        name=row.name,
        phone=row.phone,
        address=row.address,
        pets=pets,
    )


async def create_customer(db: AsyncSession, data: CustomerCreate) -> CustomerOut:
    # 检查手机号唯一
    existing = await db.execute(
        text("SELECT 1 FROM customer WHERE phone = :phone"),
        {"phone": data.phone},
    )
    if existing.fetchone():
        raise Conflict(detail="手机号已存在")

    result = await db.execute(
        text(
            "INSERT INTO customer (name, phone, address) "
            "VALUES (:name, :phone, :addr) "
            "RETURNING customer_id, name, phone, address"
        ),
        {"name": data.name, "phone": data.phone, "addr": data.address},
    )
    row = result.fetchone()
    await _invalidate_cache()
    return CustomerOut(
        customer_id=row.customer_id,
        name=row.name,
        phone=row.phone,
        address=row.address,
        pets=[],
    )


async def update_customer(db: AsyncSession, customer_id: int, data: CustomerUpdate) -> CustomerOut:
    result = await db.execute(
        text("SELECT customer_id, name, phone, address FROM customer WHERE customer_id = :id"),
        {"id": customer_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="客户不存在")

    # 只更新提供的字段
    new_name = data.name if data.name is not None else row.name
    new_phone = data.phone if data.phone is not None else row.phone
    new_address = data.address if data.address is not None else row.address

    await db.execute(
        text(
            "UPDATE customer SET name = :name, phone = :phone, address = :addr "
            "WHERE customer_id = :id"
        ),
        {"name": new_name, "phone": new_phone, "addr": new_address, "id": customer_id},
    )
    await _invalidate_cache()

    pet_result = await db.execute(
        text(
            "SELECT pet_id, customer_id, name, species, breed, birth_date, photo_key "
            "FROM pet WHERE customer_id = :cid ORDER BY pet_id"
        ),
        {"cid": customer_id},
    )
    pets = [PetOut.model_validate(p._mapping) for p in pet_result.fetchall()]
    return CustomerOut(
        customer_id=customer_id,
        name=new_name,
        phone=new_phone,
        address=new_address,
        pets=pets,
    )


async def delete_customer(db: AsyncSession, customer_id: int) -> None:
    result = await db.execute(
        text("DELETE FROM customer WHERE customer_id = :id RETURNING customer_id"),
        {"id": customer_id},
    )
    if result.fetchone() is None:
        raise NotFound(detail="客户不存在")
    await _invalidate_cache()


async def add_pet(db: AsyncSession, customer_id: int, data: PetCreate) -> PetOut:
    # 验证客户存在
    c = await db.execute(
        text("SELECT customer_id FROM customer WHERE customer_id = :id"),
        {"id": customer_id},
    )
    if c.fetchone() is None:
        raise NotFound(detail="客户不存在")

    result = await db.execute(
        text(
            "INSERT INTO pet (customer_id, name, species, breed, birth_date, photo_key) "
            "VALUES (:cid, :name, :species, :breed, :bdate, :pkey) "
            "RETURNING pet_id, customer_id, name, species, breed, birth_date, photo_key"
        ),
        {
            "cid": customer_id,
            "name": data.name,
            "species": data.species,
            "breed": data.breed,
            "bdate": data.birth_date,
            "pkey": data.photo_key,
        },
    )
    row = result.fetchone()
    await _invalidate_cache()
    return PetOut.model_validate(row._mapping)


async def update_pet(db: AsyncSession, customer_id: int, pet_id: int, data: PetUpdate) -> PetOut:
    result = await db.execute(
        text(
            "SELECT pet_id, customer_id, name, species, breed, birth_date, photo_key "
            "FROM pet WHERE pet_id = :pid AND customer_id = :cid"
        ),
        {"pid": pet_id, "cid": customer_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="宠物不存在")

    new_name = data.name if data.name is not None else row.name
    new_species = data.species if data.species is not None else row.species
    new_breed = data.breed if data.breed is not None else row.breed
    new_bdate = data.birth_date if data.birth_date is not None else row.birth_date
    new_photo_key = data.photo_key if data.photo_key is not None else row.photo_key

    await db.execute(
        text(
            "UPDATE pet SET name = :name, species = :sp, breed = :breed, birth_date = :bdate, "
            "photo_key = :pkey WHERE pet_id = :pid"
        ),
        {
            "name": new_name, "sp": new_species, "breed": new_breed, "bdate": new_bdate,
            "pkey": new_photo_key, "pid": pet_id,
        },
    )
    await _invalidate_cache()
    return PetOut(
        pet_id=pet_id,
        customer_id=customer_id,
        name=new_name,
        species=new_species,
        breed=new_breed,
        birth_date=new_bdate,
        photo_key=new_photo_key,
    )


async def delete_pet(db: AsyncSession, customer_id: int, pet_id: int) -> None:
    result = await db.execute(
        text("DELETE FROM pet WHERE pet_id = :pid AND customer_id = :cid RETURNING pet_id"),
        {"pid": pet_id, "cid": customer_id},
    )
    if result.fetchone() is None:
        raise NotFound(detail="宠物不存在")
    await _invalidate_cache()


async def get_customer_history(
    db: AsyncSession, customer_id: int
) -> list[dict]:
    """客户就诊历史聚合"""
    visits = await db.execute(
        text(
            "SELECT v.visit_id, v.pet_id, v.employee_id, v.visit_time, v.complaint, v.status, "
            "p.name AS pet_name "
            "FROM visit v JOIN pet p ON v.pet_id = p.pet_id "
            "WHERE p.customer_id = :cid "
            "ORDER BY v.visit_time DESC"
        ),
        {"cid": customer_id},
    )
    visit_rows = visits.fetchall()
    if not visit_rows:
        return []

    # 批量查询 diagnosis（一次 PG 查询）
    visit_ids = [v.visit_id for v in visit_rows]
    diag_result = await db.execute(
        text(
            "SELECT diagnosis_id, visit_id, diagnosis_result, notes "
            "FROM diagnosis WHERE visit_id = ANY(:vids)"
        ),
        {"vids": visit_ids},
    )
    diag_rows = diag_result.fetchall()

    # 组装结果
    diag_by_visit = {d.visit_id: d for d in diag_rows}
    result = []
    for v in visit_rows:
        visit_data = {
            "visit_id": v.visit_id,
            "pet_id": v.pet_id,
            "pet_name": v.pet_name,
            "employee_id": v.employee_id,
            "visit_time": v.visit_time.isoformat(),
            "complaint": v.complaint,
            "status": v.status,
            "diagnosis": None,
        }
        d = diag_by_visit.get(v.visit_id)
        if d:
            visit_data["diagnosis"] = {
                "diagnosis_id": d.diagnosis_id,
                "diagnosis_result": d.diagnosis_result,
                "notes": d.notes,
            }

        result.append(visit_data)

    return result
