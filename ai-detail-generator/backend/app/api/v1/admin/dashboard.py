from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.api.v1.auth import get_current_admin
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.asset import Asset
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 总用户数
    total_users = db.query(func.count(User.id)).scalar() or 0
    
    # 总生成量
    total_tasks = db.query(func.count(Task.id)).scalar() or 0
    
    # 总存储使用量（简化计算，实际应根据文件大小计算）
    total_assets = db.query(func.count(Asset.id)).scalar() or 0
    estimated_storage = total_assets * 2  # 假设平均每个资产 2MB
    
    # 最近7天的生成趋势
    trend_data = []
    for i in range(6, -1, -1):
        date = datetime.now() - timedelta(days=i)
        start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        daily_tasks = db.query(func.count(Task.id)).filter(
            Task.created_at >= start_date,
            Task.created_at <= end_date
        ).scalar() or 0
        
        trend_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "count": daily_tasks
        })
    
    return {
        "total_users": total_users,
        "total_generations": total_tasks,
        "estimated_storage_gb": estimated_storage / 1024,
        "generation_trend": trend_data
    }