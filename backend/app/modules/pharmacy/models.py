from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base


class Medicine(Base):
    __tablename__ = "medicine"

    medicine_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)


class MedicineBatch(Base):
    __tablename__ = "medicine_batch"

    batch_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medicine_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("medicine.medicine_id"), nullable=False
    )
    in_date: Mapped[date] = mapped_column(Date, nullable=False)
    expire_date: Mapped[date] = mapped_column(Date, nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_price: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
