from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class AdmitCreate(BaseModel):
    visit_id: int
    ward_id: int
    admit_date: date


class AdmitOut(BaseModel):
    hosp_id: int
    visit_id: int
    ward_id: int
    admit_date: str
    discharge_date: str | None
    status: str

    model_config = {"from_attributes": True}


class WardOut(BaseModel):
    ward_id: int
    ward_no: str
    type: str
    status: str
    daily_rate: Decimal

    model_config = {"from_attributes": True}


class NursingCreate(BaseModel):
    employee_id: int
    content: str = Field(min_length=1)


class NursingOut(BaseModel):
    record_id: int
    hosp_id: int
    employee_id: int
    record_time: str
    content: str

    model_config = {"from_attributes": True}


class HospDetailOut(BaseModel):
    hosp_id: int
    visit_id: int
    ward_id: int
    admit_date: str
    discharge_date: str | None
    status: str
    nursing_records: list[dict]

    model_config = {"from_attributes": True}
