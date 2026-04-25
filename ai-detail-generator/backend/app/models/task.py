from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # generate, edit, etc.
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    params = Column(Text)  # JSON string of parameters
    result = Column(Text)  # JSON string of result
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="tasks")
    project = relationship("Project", back_populates="tasks")