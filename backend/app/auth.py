"""Shared session authentication and administrator authorization."""
import hashlib
import os
from datetime import datetime
from fastapi import Depends, HTTPException, Request
from .db import get_db, User, LoginSession


def current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get('session', '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires < datetime.utcnow():
        raise HTTPException(401, '请先登录')
    return db.get(User, session.user_id)


def can_reset(user):
    email = os.getenv('ADMIN_EMAIL', '').strip().lower()
    return bool(email) and user.email.lower() == email


def require_admin(user=Depends(current_user)):
    if not can_reset(user):
        raise HTTPException(403, '仅管理员可管理教材')
    return user
