"""Validated local cover uploads, served through authenticated same-origin URLs."""
from io import BytesIO
import os
from pathlib import Path
import re
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from .auth import current_user, require_admin

router = APIRouter(prefix='/api')
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000


def upload_directory():
    return Path(os.getenv('UPLOAD_DIR') or Path(__file__).resolve().parents[1] / 'uploads').resolve()


def store_cover(data):
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in {'PNG', 'JPEG', 'WEBP'}:
                raise HTTPException(415, '仅支持 JPG、PNG 和 WebP 图片')
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(422, '图片尺寸过大，请使用不超过 1600 万像素的图片')
            image.load()
            normalized = ImageOps.exif_transpose(image).convert('RGBA')
            normalized.thumbnail((1600, 1600))
            output = BytesIO()
            normalized.save(output, format='WEBP', quality=90)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(400, '图片无法读取，请选择有效的 JPG、PNG 或 WebP 文件')
    name = f'{uuid4().hex}.webp'
    try:
        directory = upload_directory()
        directory.mkdir(parents=True, exist_ok=True)
        (directory / name).write_bytes(output.getvalue())
    except OSError:
        raise HTTPException(503, '封面保存失败，请检查上传目录权限后重试')
    return {'url': f'/api/covers/{name}'}


@router.post('/admin/covers', status_code=201, dependencies=[Depends(require_admin)])
async def upload_cover(file: UploadFile):
    try:
        if file.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
            raise HTTPException(415, '仅支持 JPG、PNG 和 WebP 图片')
        data = await file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, '封面图片不能超过 5 MB')
        return await run_in_threadpool(store_cover, data)
    finally:
        await file.close()


@router.get('/covers/{filename}', dependencies=[Depends(current_user)])
def read_cover(filename: str):
    if not re.fullmatch(r'[0-9a-f]{32}\.webp', filename):
        raise HTTPException(404, '封面不存在')
    path = upload_directory() / filename
    if not path.is_file():
        raise HTTPException(404, '封面不存在')
    return FileResponse(path, media_type='image/webp')
