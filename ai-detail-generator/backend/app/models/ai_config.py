from sqlalchemy import Column, Integer, String, Boolean, Text
from app.core.database import Base


class AIConfig(Base):
    __tablename__ = "ai_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    model_type = Column(String, nullable=False)  # image_understanding, text_generation, image_generation
    model_id = Column(String, nullable=False)  # LiteLLM model identifier
    api_key = Column(Text, nullable=True)
    api_base = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    status = Column(String, default='enabled')