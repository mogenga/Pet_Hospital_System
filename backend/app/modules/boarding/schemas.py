from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class BoardingCreate(BaseModel):
    pet_id: int
    ward_id: int
    start_date: date
    photo_key: str | None = None


class BoardingOut(BaseModel):
    boarding_id: int
    pet_id: int
    ward_id: int
    start_date: str
    end_date: str | None = None
    photo_key: str | None = None

    model_config = {"from_attributes": True}


class BoardingDetailOut(BaseModel):
    boarding_id: int
    pet_id: int
    pet_name: str
    ward_id: int
    ward_no: str
    start_date: str
    end_date: str | None = None
    daily_rate: Decimal
    current_fee: Decimal
    photo_key: str | None = None

    model_config = {"from_attributes": True}
