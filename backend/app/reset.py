"""Atomic practice reset. Call only after administrator re-authentication."""
from sqlalchemy import delete, select
from .db import User, Attempt, Star, Exercise, LoginSession, Chapter, Book
from .seed import sync_book

def reset_practice(db, book, keep_session_hash):
    users = list(db.scalars(select(User).order_by(User.id).with_for_update().execution_options(populate_existing=True)))
    db.execute(delete(Attempt))
    db.execute(delete(Star))
    db.execute(delete(Exercise))
    db.execute(delete(Chapter))
    db.execute(delete(Book))
    # Keep only the invoking session. Other devices must reload the rebuilt bank.
    db.execute(delete(LoginSession).where(LoginSession.token_hash != keep_session_hash))
    for user in users:
        user.hearts = 5
        user.xp = user.gems = user.streak = 0
        user.last_practice = None
    sync_book(db, book)
    db.flush()
    return len(users)
