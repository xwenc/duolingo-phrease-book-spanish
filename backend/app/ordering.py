"""Allocate a trailing position for new books without disturbing existing books."""
from sqlalchemy import select
from .db import Book


def next_book_order(db):
    last = db.scalar(select(Book).order_by(Book.sort_order.desc(), Book.id.desc()).limit(1).with_for_update())
    return 0 if last is None else last.sort_order + 1
