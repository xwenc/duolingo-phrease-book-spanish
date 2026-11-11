"""Bootstrap the environment-configured administrator without resetting practice data."""
import os
import re
from pwdlib import PasswordHash
from sqlalchemy import select, delete
from .db import User, LoginSession

password_hash = PasswordHash.recommended()


def admin_credentials():
    email = os.getenv('ADMIN_EMAIL', '').strip().lower()
    password = os.getenv('ADMIN_PASSWORD', '')
    if not email and not password:
        return None
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or len(email) > 254:
        raise ValueError('ADMIN_EMAIL must be a valid email address')
    if not 12 <= len(password) <= 128:
        raise ValueError('ADMIN_PASSWORD must contain 12 to 128 characters')
    return email, password


def sync_admin(db):
    credentials = admin_credentials()
    if credentials is None:
        return
    email, password = credentials
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if user is None:
        db.add(User(email=email, password=password_hash.hash(password)))
    elif not password_hash.verify(password, user.password):
        user.password = password_hash.hash(password)
        db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.flush()
