from datetime import datetime

from pydantic import BaseModel


# ══════════════════════════ Visit ══════════════════════════

class VisitCreate(BaseModel):
    pet_id: int
    employee_id: int
    complaint: str | None = None


class VisitOut(BaseModel):
    visit_id: int
    pet_id: int
    employee_id: int
    visit_time: datetime
    complaint: str | None
    status: str

    model_config = {"from_attributes": True}


# ══════════════════════════ Diagnosis ══════════════════════════

class DiagnosisCreate(BaseModel):
    diagnosis_result: str
    notes: str | None = None


class DiagnosisOut(BaseModel):
    diagnosis_id: int
    visit_id: int
    diagnosis_result: str
    notes: str | None

    model_config = {"from_attributes": True}


# ══════════════════════════ Prescription ══════════════════════════

class PrescriptionItemCreate(BaseModel):
    batch_id: int
    quantity: int
    dosage: str | None = None


class PrescriptionCreate(BaseModel):
    items: list[PrescriptionItemCreate]


class PrescriptionItemOut(BaseModel):
    item_id: int
    diagnosis_id: int
    batch_id: int
    quantity: int
    dosage: str | None

    model_config = {"from_attributes": True}
