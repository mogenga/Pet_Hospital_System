from datetime import date

from sqlalchemy import Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base


class Boarding(Base):
    __tablename__ = "boarding"

    boarding_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pet_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pet.pet_id"), nullable=False
    )
    ward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ward.ward_id"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
