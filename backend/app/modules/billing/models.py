from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base


class Bill(Base):
    __tablename__ = "bill"

    bill_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visit.visit_id"), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="未结清")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())


class BillItem(Base):
    __tablename__ = "bill_item"

    bill_item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bill_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bill.bill_id"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String(200))
    amount: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("bill_id", "source_type", "source_id", name="uq_bill_item_source"),
    )
