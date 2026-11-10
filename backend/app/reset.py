"""Atomic practice reset. Call only after administrator re-authentication."""
from sqlalchemy import delete, select
from .db import User, Attempt, Star, Exercise, LoginSession
from .seed import sync_exercises

def reset_practice(db, rows, keep_session_hash):
    users = list(db.scalars(select(User).order_by(User.id).with_for_update().execution_options(populate_existing=True)))
    db.execute(delete(Attempt))
    db.execute(delete(Star))
    db.execute(delete(Exercise))
    # Keep only the invoking session. Other devices must reload the rebuilt bank.
    db.execute(delete(LoginSession).where(LoginSession.token_hash != keep_session_hash))
    for user in users:
        user.hearts = 5
        user.xp = user.gems = user.streak = 0
        user.last_practice = None
    sync_exercises(db, rows)
    db.flush()
    return len(users)
