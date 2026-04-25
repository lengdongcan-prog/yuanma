from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: int
    is_admin: bool


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 确保user_id是整数类型
    try:
        user_id = int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


@router.post("/register", response_model=Token)
async def register(user_create: UserCreate, db: Session = Depends(get_db)):
    # 检查用户名是否已存在
    db_user = db.query(User).filter(User.username == user_create.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    # 检查邮箱是否已存在
    db_user = db.query(User).filter(User.email == user_create.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    # 创建新用户
    hashed_password = get_password_hash(user_create.password)
    db_user = User(
        username=user_create.username,
        email=user_create.email,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    # 创建访问令牌
    access_token = create_access_token(
        data={"sub": str(db_user.id), "is_admin": db_user.is_admin}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 查找用户
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 创建访问令牌
    access_token = create_access_token(
        data={"sub": str(user.id), "is_admin": user.is_admin}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/admin/login", response_model=Token)
async def admin_login(admin_login: AdminLogin, db: Session = Depends(get_db)):
    # 完全独立的登录验证，不依赖数据库
    if admin_login.username == "admin" and admin_login.password == "admin123":
        # 直接生成令牌，不依赖数据库
        access_token = create_access_token(
            data={"sub": "1", "is_admin": True}
        )
        return {"access_token": access_token, "token_type": "bearer"}
    else:
        # 登录失败
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/create-admin")
async def create_admin(db: Session = Depends(get_db)):
    """创建管理员账号（仅用于初始化）"""
    # 检查是否已有管理员账号
    admin = db.query(User).filter(User.is_admin == True).first()
    if admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin user already exists"
        )
    
    # 创建管理员账号
    hashed_password = get_password_hash("admin123")
    
    # 使用直接 SQL 语句插入
    db.execute(
        "INSERT INTO users (username, email, password_hash, is_admin, is_active) VALUES (:username, :email, :password_hash, :is_admin, :is_active)",
        {
            "username": "admin",
            "email": "admin@example.com",
            "password_hash": hashed_password,
            "is_admin": 1,
            "is_active": 1
        }
    )
    db.commit()
    
    return {"message": "Admin user created successfully", "username": "admin", "password": "admin123"}