from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 数据库配置
    DATABASE_URL: str = "sqlite:///app.db"
    
    # JWT 配置
    SECRET_KEY: str = "your-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 上传配置
    UPLOAD_DIR: str = "../public_html/uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # AI 模型配置
    DEFAULT_IMAGE_UNDERSTANDING_MODEL: str = "gpt-4-vision-preview"
    DEFAULT_TEXT_GENERATION_MODEL: str = "gpt-4"
    DEFAULT_IMAGE_GENERATION_MODEL: str = "dall-e-3"
    
    # 模型尺寸限制配置
    MODEL_SIZE_LIMITS: dict = {
        "seedream": {"min_pixels": 3686400},
        "flux-pro": {"min_pixels": 0},
        "gpt-image-2": {"min_pixels": 0},
        "default": {"min_pixels": 0}
    }
    
    # API Keys
    OPENAI_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()