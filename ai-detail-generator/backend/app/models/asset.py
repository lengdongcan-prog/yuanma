from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    type = Column(String)  # image, video, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="assets")
    project = relationship("Project", back_populates="assets")