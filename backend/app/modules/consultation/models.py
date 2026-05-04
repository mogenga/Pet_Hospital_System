from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base


class Visit(Base):
    __tablename__ = "visit"

    visit_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pet_id: Mapped[int] = mapped_column(Integer, ForeignKey("pet.pet_id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employee.employee_id"), nullable=False)
    visit_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    complaint: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="待接诊")


class Diagnosis(Base):
    __tablename__ = "diagnosis"

    diagnosis_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(Integer, ForeignKey("visit.visit_id"), nullable=False, unique=True)
    diagnosis_result: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class PrescriptionItem(Base):
    __tablename__ = "prescription_item"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(Integer, ForeignKey("diagnosis.diagnosis_id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("medicine_batch.batch_id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(100))
