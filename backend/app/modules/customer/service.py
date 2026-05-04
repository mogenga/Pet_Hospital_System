import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFound
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
    customers: list[CustomerOut] = []
    for row in result.fetchall():
        pet_result = await db.execute(
            text(
                "SELECT pet_id, customer_id, name, species, breed, birth_date "
                "FROM pet WHERE customer_id = :cid ORDER BY pet_id"
            ),
            {"cid": row.customer_id},
        )
        pets = [PetOut.model_validate(p._mapping) for p in pet_result.fetchall()]
        customers.append(
            CustomerOut(
                customer_id=row.customer_id,
                name=row.name,
                phone=row.phone,
                address=row.address,
                pets=pets,
            )
        )

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
            "SELECT pet_id, customer_id, name, species, breed, birth_date "
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
            "SELECT pet_id, customer_id, name, species, breed, birth_date "
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
            "INSERT INTO pet (customer_id, name, species, breed, birth_date) "
            "VALUES (:cid, :name, :species, :breed, :bdate) "
            "RETURNING pet_id, customer_id, name, species, breed, birth_date"
        ),
        {
            "cid": customer_id,
            "name": data.name,
            "species": data.species,
            "breed": data.breed,
            "bdate": data.birth_date,
        },
    )
    row = result.fetchone()
    await _invalidate_cache()
    return PetOut.model_validate(row._mapping)


async def update_pet(db: AsyncSession, customer_id: int, pet_id: int, data: PetUpdate) -> PetOut:
    result = await db.execute(
        text(
            "SELECT pet_id, customer_id, name, species, breed, birth_date "
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

    await db.execute(
        text(
            "UPDATE pet SET name = :name, species = :sp, breed = :breed, birth_date = :bdate "
            "WHERE pet_id = :pid"
        ),
        {"name": new_name, "sp": new_species, "breed": new_breed, "bdate": new_bdate, "pid": pet_id},
    )
    await _invalidate_cache()
    return PetOut(
        pet_id=pet_id,
        customer_id=customer_id,
        name=new_name,
        species=new_species,
        breed=new_breed,
        birth_date=new_bdate,
    )


async def delete_pet(db: AsyncSession, customer_id: int, pet_id: int) -> None:
    result = await db.execute(
        text("DELETE FROM pet WHERE pet_id = :pid AND customer_id = :cid RETURNING pet_id"),
        {"pid": pet_id, "cid": customer_id},
    )
    if result.fetchone() is None:
        raise NotFound(detail="宠物不存在")
    await _invalidate_cache()
