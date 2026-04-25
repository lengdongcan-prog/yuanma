from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.core.security import verify_password, get_password_hash
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()


class UserProfile(BaseModel):
    username: str
    email: str
    
    class Config:
        from_attributes = True


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


@router.get("/", response_model=UserProfile)
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.put("/password")
async def update_password(
    password_update: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 验证当前密码
    if not verify_password(password_update.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # 更新密码
    current_user.password_hash = get_password_hash(password_update.new_password)
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Password updated successfully"}