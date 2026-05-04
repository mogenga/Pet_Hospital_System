from datetime import date

from pydantic import BaseModel, Field


class MedicineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=20)
    unit_price: float = Field(ge=0)
    category: str = Field(min_length=1, max_length=50)


class MedicineOut(BaseModel):
    medicine_id: int
    name: str
    unit: str
    unit_price: float
    category: str

    model_config = {"from_attributes": True}


class BatchCreate(BaseModel):
    medicine_id: int
    in_date: date
    expire_date: date
    stock_qty: int = Field(ge=0)
    cost_price: float = Field(ge=0)


class BatchOut(BaseModel):
    batch_id: int
    medicine_id: int
    medicine_name: str
    in_date: date
    expire_date: date
    stock_qty: int
    cost_price: float

    model_config = {"from_attributes": True}
