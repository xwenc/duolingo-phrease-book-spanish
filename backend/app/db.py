import os
from datetime import datetime
from sqlalchemy import create_engine, String, Text, Integer, JSON, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

database_url = os.environ['DATABASE_URL']
# Auth reads precede the account lock. Under MySQL REPEATABLE READ, later
# idempotency/reward reads would otherwise retain the pre-lock snapshot.
engine_options = {'isolation_level': 'READ COMMITTED'} if database_url.startswith('mysql') else {}
engine = create_engine(database_url, pool_pre_ping=True, **engine_options)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase):
    pass
class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    hearts: Mapped[int] = mapped_column(default=5)
    xp: Mapped[int] = mapped_column(default=0)
    gems: Mapped[int] = mapped_column(default=0)
    streak: Mapped[int] = mapped_column(default=0)
    last_practice: Mapped[str | None] = mapped_column(String(10), nullable=True)
class LoginSession(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    expires: Mapped[datetime] = mapped_column(DateTime)
class Book(Base):
    __tablename__ = 'books'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    thumbnail: Mapped[str] = mapped_column(String(2048), default='')
class Chapter(Base):
    __tablename__ = 'chapters'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey('books.id'), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    icon: Mapped[str] = mapped_column(String(32), default='📖')
class Exercise(Base):
    __tablename__ = 'exercises'
    __table_args__ = (Index('ix_exercises_chapter_order', 'chapter_id', 'sort_order'),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default='0')
    chapter_id: Mapped[str | None] = mapped_column(ForeignKey('chapters.id'), nullable=True, index=True)
class Star(Base):
    __tablename__ = 'stars'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey('exercises.id'), primary_key=True)
class Attempt(Base):
    __tablename__ = 'attempts'
    __table_args__ = (UniqueConstraint('user_id', 'request_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    exercise_id: Mapped[str] = mapped_column(ForeignKey('exercises.id'))
    request_id: Mapped[str] = mapped_column(String(36))
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

def get_db():
    with SessionLocal() as db:
        yield db
