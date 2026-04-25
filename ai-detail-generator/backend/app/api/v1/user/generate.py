from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskStatus
from pydantic import BaseModel
import json
from app.tasks.generation import generate_detail_page

router = APIRouter()


class GenerateRequest(BaseModel):
    project_id: int
    product_name: str
    product_description: str
    product_features: str
    platform: str
    image_size: str
    generate_count: int
    custom_prompt: str = None
    image_ids: List[int] = []


class TaskResponse(BaseModel):
    id: int
    status: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/", response_model=TaskResponse)
async def generate_detail_page_task(
    generate_request: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == generate_request.project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    task = Task(
        type="generate",
        status=TaskStatus.PENDING,
        user_id=current_user.id,
        project_id=generate_request.project_id,
        params=json.dumps(generate_request.model_dump())
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(
        generate_detail_page,
        task.id,
        generate_request.model_dump()
    )

    return task


@router.get("/task/{task_id}", response_model=TaskResponse)
async def get_task_status(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    return task
