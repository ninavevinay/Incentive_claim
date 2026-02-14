from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.core.database import get_db
from app.core.routing import dashboard_path_for_user, slugify_department
from app.models.user import User
from app.schemas.user import UserUpdate, UserOut

router = APIRouter(prefix="/profile", tags=["profile"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department=user.department,
        department_slug=slugify_department(user.department),
        dashboard_path=dashboard_path_for_user(user.role, user.department),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _to_user_out(user)

@router.put("/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.name is not None:
        user.name = payload.name
    if payload.department is not None:
        user.department = payload.department
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_user_out(user)
