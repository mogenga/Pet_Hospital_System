from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base


class Ward(Base):
    __tablename__ = "ward"

    ward_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ward_no: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="空闲")
    daily_rate: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)


class Hospitalization(Base):
    __tablename__ = "hospitalization"

    hosp_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visit.visit_id"), nullable=False, unique=True
    )
    ward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ward.ward_id"), nullable=False
    )
    admit_date: Mapped[date] = mapped_column(Date, nullable=False)
    discharge_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="住院中")


class NursingRecord(Base):
    __tablename__ = "nursing_record"

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hosp_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hospitalization.hosp_id"), nullable=False
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employee.employee_id"), nullable=False
    )
    record_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    content: Mapped[str] = mapped_column(Text, nullable=False)
