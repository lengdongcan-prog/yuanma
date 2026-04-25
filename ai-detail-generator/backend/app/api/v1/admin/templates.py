from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import json
from app.core.database import get_db
from app.api.v1.auth import get_current_admin
from app.models.template import Template
from app.models.user import User
from pydantic import BaseModel
from typing import List

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    platform: str
    size: str
    content: dict


class TemplateResponse(BaseModel):
    id: int
    name: str
    platform: str
    size: str
    is_default: bool
    created_at: str
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[TemplateResponse])
async def get_templates(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    templates = db.query(Template).all()
    return templates


@router.post("/")
async def create_template(
    template_create: TemplateCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 如果设为默认，将其他模板设为非默认
    if template_create.is_default:
        db.query(Template).filter(
            Template.platform == template_create.platform,
            Template.size == template_create.size
        ).update({"is_default": False})
    
    db_template = Template(
        name=template_create.name,
        platform=template_create.platform,
        size=template_create.size,
        content=json.dumps(template_create.content)
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 检查文件类型
    if not file.filename.endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are allowed"
        )
    
    # 读取文件内容
    try:
        content = await file.read()
        template_data = json.loads(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON file: {str(e)}"
        )
    
    # 验证必要字段
    required_fields = ["name", "platform", "size", "content"]
    for field in required_fields:
        if field not in template_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )
    
    # 如果设为默认，将其他模板设为非默认
    if template_data.get("is_default", False):
        db.query(Template).filter(
            Template.platform == template_data["platform"],
            Template.size == template_data["size"]
        ).update({"is_default": False})
    
    # 创建模板
    db_template = Template(
        name=template_data["name"],
        platform=template_data["platform"],
        size=template_data["size"],
        content=json.dumps(template_data["content"]),
        is_default=template_data.get("is_default", False)
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.put("/{template_id}/default")
async def set_default_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # 将其他模板设为非默认
    db.query(Template).filter(
        Template.platform == template.platform,
        Template.size == template.size
    ).update({"is_default": False})
    
    # 将当前模板设为默认
    template.is_default = True
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}