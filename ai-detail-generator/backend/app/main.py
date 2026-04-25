from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, upload
from app.api.v1.user import projects, generate, profile
from app.api.v1.admin import users, projects as admin_projects, templates, dashboard, settings
from app.core.database import engine, Base

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI 电商详情页生成器 API",
    description="AI 电商详情页生成器后端 API",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["上传"])
app.include_router(projects.router, prefix="/api/v1/user/projects", tags=["用户项目"])
app.include_router(generate.router, prefix="/api/v1/user/generate", tags=["生成"])
app.include_router(profile.router, prefix="/api/v1/user/profile", tags=["用户资料"])
app.include_router(users.router, prefix="/api/v1/admin/users", tags=["管理员用户管理"])
app.include_router(admin_projects.router, prefix="/api/v1/admin/projects", tags=["管理员项目管理"])
app.include_router(templates.router, prefix="/api/v1/admin/templates", tags=["模板管理"])
app.include_router(dashboard.router, prefix="/api/v1/admin/dashboard", tags=["数据看板"])
app.include_router(settings.router, prefix="/api/v1/admin/settings", tags=["系统设置"])

@app.get("/")
async def root():
    return {"message": "AI 电商详情页生成器 API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}