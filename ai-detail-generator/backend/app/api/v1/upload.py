from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.asset import Asset
from app.config import settings

router = APIRouter()


@router.post("/image")
async def upload_image(
    files: List[UploadFile] = File(...),
    project_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    uploaded_files = []
    for file in files:
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )

        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save file: {str(e)}"
            )

        asset = Asset(
            name=file.filename,
            path=unique_filename,
            type="image",
            user_id=current_user.id,
            project_id=project_id
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        uploaded_files.append({
            "id": asset.id,
            "name": asset.name,
            "url": f"/uploads/{asset.path}",
            "path": asset.path
        })

    return {"files": uploaded_files}
