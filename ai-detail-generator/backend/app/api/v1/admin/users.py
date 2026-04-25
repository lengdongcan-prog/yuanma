from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_admin
from app.models.user import User
from pydantic import BaseModel
from typing import List

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: str
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    is_active: bool = None
    is_admin: bool = None


@router.get("/", response_model=List[UserResponse])
async def get_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    users = db.query(User).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 不能修改自己的管理员状态
    if user_id == current_admin.id and user_update.is_admin is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change own admin status"
        )
    
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 不能删除自己
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}