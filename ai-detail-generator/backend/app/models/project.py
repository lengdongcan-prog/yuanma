from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    platform = Column(String)
    image_size = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="projects")
    assets = relationship("Asset", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")