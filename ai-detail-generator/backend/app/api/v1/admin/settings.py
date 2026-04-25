from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_admin
from app.models.user import User
from app.models.ai_config import AIConfig
from pydantic import BaseModel
from typing import List
import json

router = APIRouter()


class AIConfigCreate(BaseModel):
    name: str
    model_type: str
    model_id: str
    api_key: str = None
    api_base: str = None
    is_default: bool = False
    is_enabled: bool = True


class AIConfigResponse(BaseModel):
    id: int
    name: str
    model_type: str
    model_id: str
    is_default: bool
    is_enabled: bool
    
    class Config:
        from_attributes = True
    
    @classmethod
    def model_validate(cls, db_model):
        # 处理数据库中的status字段，转换为is_enabled
        return cls(
            id=db_model.id,
            name=db_model.name,
            model_type=db_model.model_type,
            model_id=db_model.model_id,
            is_default=bool(db_model.is_default),
            is_enabled=db_model.status == 'enabled'
        )


@router.get("/ai-models")
async def get_ai_models(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    models = db.query(AIConfig).all()
    # 手动转换模型数据
    result = []
    for model in models:
        result.append({
            "id": model.id,
            "name": model.name,
            "model_type": model.model_type,
            "model_id": model.model_id,
            "is_default": bool(model.is_default),
            "is_enabled": model.status == 'enabled'
        })
    return result


@router.post("/ai-models")
async def create_ai_model(
    ai_config: AIConfigCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 如果设为默认，将同类型的其他模型设为非默认
    if ai_config.is_default:
        db.query(AIConfig).filter(
            AIConfig.model_type == ai_config.model_type
        ).update({"is_default": False})
    
    # 转换is_enabled为status字段
    model_data = ai_config.model_dump()
    status = 'enabled' if model_data.pop('is_enabled') else 'disabled'
    
    db_config = AIConfig(
        **model_data,
        status=status
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.put("/ai-models/{model_id}")
async def update_ai_model(
    model_id: int,
    ai_config: AIConfigCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    db_config = db.query(AIConfig).filter(AIConfig.id == model_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    # 如果设为默认，将同类型的其他模型设为非默认
    if ai_config.is_default:
        db.query(AIConfig).filter(
            AIConfig.model_type == ai_config.model_type
        ).update({"is_default": False})
    
    # 转换is_enabled为status字段
    update_data = ai_config.model_dump()
    status = 'enabled' if update_data.pop('is_enabled') else 'disabled'
    update_data['status'] = status
    
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    return db_config


@router.delete("/ai-models/{model_id}")
async def delete_ai_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    db_config = db.query(AIConfig).filter(AIConfig.id == model_id).first()
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    db.delete(db_config)
    db.commit()
    return {"message": "Model deleted successfully"}