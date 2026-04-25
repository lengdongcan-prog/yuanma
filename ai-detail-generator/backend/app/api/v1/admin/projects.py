from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_admin
from app.models.project import Project
from app.models.user import User
from pydantic import BaseModel
from typing import List

router = APIRouter()


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str = None
    user_id: int
    username: str
    platform: str = None
    image_size: str = None
    created_at: str
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[ProjectResponse])
async def get_all_projects(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    projects = db.query(Project).join(User).all()
    result = []
    for project in projects:
        result.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "user_id": project.user_id,
            "username": project.user.username,
            "platform": project.platform,
            "image_size": project.image_size,
            "created_at": project.created_at
        })
    return result


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    project = db.query(Project).filter(Project.id == project_id).join(User).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "user_id": project.user_id,
        "username": project.user.username,
        "platform": project.platform,
        "image_size": project.image_size,
        "created_at": project.created_at
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}