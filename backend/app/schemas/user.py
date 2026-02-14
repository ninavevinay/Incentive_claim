from pydantic import BaseModel, EmailStr

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    department: str
    department_slug: str | None = None
    dashboard_path: str

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
