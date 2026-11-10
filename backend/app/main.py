import hashlib
import os
import secrets
import httpx
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, date
from typing import Literal
from uuid import UUID
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import select, delete, text
from sqlalchemy.exc import IntegrityError
from .db import get_db, User, LoginSession, Exercise, Star, Attempt
from .scoring import evaluate
from .speech import speech
from .seed import load_exercises
from .reset import reset_practice

password_hash = PasswordHash.recommended()
secure_cookie = os.getenv('COOKIE_SECURE', 'true').lower() == 'true'
@asynccontextmanager
async def lifespan(app):
    await run_in_threadpool(speech.load)
    yield
app = FastAPI(title='Spanish Practice API', lifespan=lifespan)

@app.middleware('http')
async def origin_guard(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if request.headers.get('origin') != os.getenv('APP_ORIGIN', 'http://localhost:3000'):
            from fastapi.responses import JSONResponse
            return JSONResponse({'detail': '不允许的请求来源'}, status_code=403)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

def current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get('session', '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires < datetime.utcnow():
        raise HTTPException(401, '请先登录')
    return db.get(User, session.user_id)

def can_reset(user):
    email = os.getenv('RESET_ADMIN_EMAIL', '').strip().lower()
    return bool(email) and user.email.lower() == email

def stats(user, db):
    return dict(hearts=user.hearts, xp=user.xp, gems=user.gems, streak=user.streak, canResetData=can_reset(user),
                starredIds=list(db.scalars(select(Star.exercise_id).where(Star.user_id == user.id))))
class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=12, max_length=128)

@app.post('/api/auth/{action}')
def auth(action: Literal['login', 'register'], body: Credentials, response: Response, db=Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if action == 'register':
        if user:
            raise HTTPException(409, '该邮箱已注册')
        user = User(email=email, password=password_hash.hash(body.password))
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, '该邮箱已注册')
    elif not user or not password_hash.verify(body.password, user.password):
        raise HTTPException(401, '邮箱或密码错误')
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, expires=datetime.utcnow()+timedelta(days=7)))
    db.commit()
    response.set_cookie('session', token, httponly=True, secure=secure_cookie, samesite='lax', max_age=604800, path='/api')
    return stats(user, db)

@app.post('/api/logout')
def logout(request: Request, response: Response, db=Depends(get_db)):
    db.execute(delete(LoginSession).where(LoginSession.token_hash == hashlib.sha256(request.cookies.get('session', '').encode()).hexdigest()))
    db.commit()
    response.delete_cookie('session', path='/api')
    return {'ok': True}

@app.get('/api/me')
def me(user=Depends(current_user), db=Depends(get_db)):
    return stats(user, db)
@app.get('/api/exercises')
def exercises(user=Depends(current_user), db=Depends(get_db)):
    return [row.data for row in db.scalars(select(Exercise).order_by(Exercise.id))]
@app.put('/api/stars/{exercise_id}')
def star(exercise_id: str, enabled: bool, user=Depends(current_user), db=Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    if not db.get(Exercise, exercise_id):
        raise HTTPException(404, '题目不存在')
    row = db.get(Star, (user.id, exercise_id))
    if enabled and not row:
        db.add(Star(user_id=user.id, exercise_id=exercise_id))
    elif not enabled and row:
        db.delete(row)
    db.commit()
    return stats(user, db)

@app.post('/api/speech')
async def transcribe(audio: UploadFile, user=Depends(current_user)):
    if audio.content_type not in ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav'):
        raise HTTPException(415, '不支持的录音格式')
    data = await audio.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, '录音超过8MB')
    try:
        transcript = await run_in_threadpool(speech.transcribe, data)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, '无法解析录音，请重新录制')
    if not transcript:
        raise HTTPException(422, '未检测到语音')
    return {'transcript': transcript}

class Submission(BaseModel):
    requestId: UUID
    exerciseId: str = Field(max_length=64)
    transcript: str = Field(max_length=2000)
@app.post('/api/attempts')
def submit(body: Submission, user=Depends(current_user), db=Depends(get_db)):
    # Serialize mutations of one account; retrying an identical request cannot duplicate rewards.
    user = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    previous = db.scalar(select(Attempt).where(Attempt.user_id == user.id, Attempt.request_id == str(body.requestId)))
    if previous:
        if previous.exercise_id != body.exerciseId or previous.result['rawSpoken'] != body.transcript:
            raise HTTPException(409, '请求编号已使用')
        return {'evaluation': previous.result, 'stats': stats(user, db)}
    exercise = db.get(Exercise, body.exerciseId)
    if not exercise:
        raise HTTPException(404, '题目不存在')
    if user.hearts <= 0:
        raise HTTPException(409, '红心不足，请兑换红心')
    result = evaluate(exercise.data['spanish'], body.transcript)
    # Reward only the first successful completion of each exercise.
    already_passed = any(a.result['isPassed'] for a in db.scalars(select(Attempt).where(Attempt.user_id == user.id, Attempt.exercise_id == body.exerciseId)))
    if result['isPassed'] and not already_passed:
        user.xp += 15
        user.gems += 2
    elif not result['isPassed']:
        user.hearts -= 1
        if db.get(Star, (user.id, body.exerciseId)) is None:
            db.add(Star(user_id=user.id, exercise_id=body.exerciseId))
    today = date.today()
    if user.last_practice != today.isoformat():
        user.streak = user.streak + 1 if user.last_practice == (today-timedelta(days=1)).isoformat() else 1
        user.last_practice = today.isoformat()
    db.add(Attempt(user_id=user.id, exercise_id=body.exerciseId, request_id=str(body.requestId), result=result))
    db.commit()
    return {'evaluation': result, 'stats': stats(user, db)}

@app.post('/api/hearts/refill')
def refill(user=Depends(current_user), db=Depends(get_db)):
    user = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    latest = db.scalar(select(Attempt).where(Attempt.user_id == user.id).order_by(Attempt.created_at.desc()).limit(1))
    free = latest is not None and latest.created_at <= datetime.utcnow() - timedelta(minutes=30)
    if user.hearts == 5 or (user.gems < 10 and not free):
        raise HTTPException(409, '需要10颗宝石，或最后一次练习后休息30分钟')
    if not free:
        user.gems -= 10
    user.hearts = 5
    db.commit()
    return stats(user, db)
@app.get('/api/health')
def health(db=Depends(get_db)):
    db.execute(text('SELECT 1'))
    if speech.model is None:
        raise HTTPException(503, '模型尚未加载')
    return {'status': 'ok'}


@app.get('/api/tts')
def tts_audio(text: str = Query(min_length=1, max_length=500),
              speed: float = Query(default=1, ge=0.5, le=1.2),
              user=Depends(current_user)):
    if not text.strip():
        raise HTTPException(422, '朗读内容不能为空')
    try:
        result = httpx.post(os.getenv('TTS_URL', 'http://tts:8001') + '/synthesize',
                            json={'text': text, 'speed': speed}, timeout=30)
        if result.status_code == 503:
            raise HTTPException(503, '朗读服务忙，请稍后重试', headers={'Retry-After': '2'})
        result.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(503, '本地朗读服务暂不可用，请稍后重试')
    return Response(result.content, media_type='audio/wav')


class ResetRequest(BaseModel):
    password: str = Field(min_length=12, max_length=128)
    confirmed: Literal[True]

@app.post('/api/admin/reset-practice')
def reset_all(body: ResetRequest, request: Request, user=Depends(current_user), db=Depends(get_db)):
    if not can_reset(user):
        raise HTTPException(403, '仅管理员可重置全库练习数据')
    if not password_hash.verify(body.password, user.password):
        raise HTTPException(401, '管理员密码错误')
    # Validate the entire source before any destructive writes.
    try:
        rows = load_exercises()
    except (ValueError, OSError):
        raise HTTPException(503, '题库文件无效，未清空任何数据')
    token_hash = hashlib.sha256(request.cookies.get('session', '').encode()).hexdigest()
    reset_practice(db, rows, token_hash)
    db.commit()
    return {'stats': stats(user, db), 'exercises': rows}
