from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(description="用户名或手机号")
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
    """新增账号（同时创建员工）"""
    name: str = Field(min_length=1, max_length=50, description="员工姓名")
    phone: str = Field(min_length=6, max_length=20, description="手机号")
    role: str = Field(default="医生", description="角色：管理员/医生/护士")
    password: str | None = Field(default=None, min_length=6, description="密码，不填则使用电话后6位")


class AccountOut(BaseModel):
    account_id: int
    employee_id: int
    username: str
    is_active: bool
    last_login: datetime | None = None
    created_at: datetime
    # 关联的员工信息
    employee_name: str = ""
    employee_role: str = ""
    employee_phone: str = ""

    model_config = {"from_attributes": True}


class EmployeeOut(BaseModel):
    employee_id: int
    name: str
    role: str
    phone: str

    model_config = {"from_attributes": True}
