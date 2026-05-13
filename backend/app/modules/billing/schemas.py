from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class BillItemCreate(BaseModel):
    item_type: str = Field(min_length=1, max_length=30)
    source_type: str = Field(min_length=1, max_length=20)
    source_id: int
    amount: Decimal = Field(gt=0, max_digits=8, decimal_places=2)
    description: str | None = Field(default=None, max_length=200)


class BillItemOut(BaseModel):
    bill_item_id: int
    bill_id: int
    item_type: str
    source_type: str
    source_id: int
    description: str | None
    amount: Decimal

    model_config = {"from_attributes": True}


class BillOut(BaseModel):
    bill_id: int
    visit_id: int
    status: str
    created_at: str
    total_amount: Decimal | None = None

    model_config = {"from_attributes": True}


class BillDetailOut(BaseModel):
    bill_id: int
    visit_id: int
    status: str
    created_at: str
    total_amount: Decimal
    items: list[BillItemOut]

    model_config = {"from_attributes": True}
