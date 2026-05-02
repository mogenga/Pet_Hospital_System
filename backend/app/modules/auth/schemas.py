from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    account_id: int
    username: str
    name: str
    role: str
    employee_id: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class AccountCreate(BaseModel):
    employee_id: int
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)

    model_config = {"from_attributes": True}


class AccountOut(BaseModel):
    account_id: int
    employee_id: int
    username: str
    is_active: bool
    last_login: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeOut(BaseModel):
    employee_id: int
    name: str
    role: str
    phone: str

    model_config = {"from_attributes": True}
