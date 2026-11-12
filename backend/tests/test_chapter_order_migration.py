import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_chapter_migration_preserves_existing_content_and_sentence_order(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    database = tmp_path / 'chapter-order.sqlite'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{database}'}
    def migrate(target):
        subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', target], cwd=backend, env=env, check=True, capture_output=True)
    migrate('0003')
    with sqlite3.connect(database) as db:
        db.execute("INSERT INTO books (id,name,description,thumbnail) VALUES ('book','教材','描述','/cover.webp')")
        db.executemany("INSERT INTO chapters (id,book_id,name,description,icon) VALUES (?,'book',?,'','📖')", [('z', '末章'), ('a', '首章'), ('m', '中章')])
        db.execute('INSERT INTO exercises (id,chapter_id,sort_order,data) VALUES (?,?,?,?)', ('sentence', 'z', 7, '{"spanish":"Hola"}'))
    migrate('head')
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT id,sort_order FROM chapters ORDER BY sort_order').fetchall() == [('a', 0), ('m', 1), ('z', 2)]
        assert db.execute('SELECT sort_order,data FROM exercises').fetchone() == (7, '{"spanish":"Hola"}')
        assert db.execute('SELECT thumbnail FROM books').fetchone()[0] == '/cover.webp'
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    migrate('head')
