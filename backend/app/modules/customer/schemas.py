from datetime import date

from pydantic import BaseModel, Field


class PetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    species: str = Field(min_length=1, max_length=30)
    breed: str | None = None
    birth_date: date | None = None


class PetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    species: str | None = Field(default=None, min_length=1, max_length=30)
    breed: str | None = None
    birth_date: date | None = None


class PetOut(BaseModel):
    pet_id: int
    customer_id: int
    name: str
    species: str
    breed: str | None
    birth_date: date | None

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=1, max_length=20)
    address: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    address: str | None = None


class CustomerOut(BaseModel):
    customer_id: int
    name: str
    phone: str
    address: str | None
    pets: list[PetOut] = []

    model_config = {"from_attributes": True}
