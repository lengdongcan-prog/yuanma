from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Template(Base):
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    size = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # JSON string of template configuration
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())