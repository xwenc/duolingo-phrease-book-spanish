"""Exercise the real Alembic migration against an existing question bank."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_existing_bank_is_migrated_without_losing_progress(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    database = tmp_path / 'migration.sqlite'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{database}'}

    def migrate(target):
        subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', target], cwd=backend, env=env, check=True, capture_output=True)

    migrate('0001')
    # A historical flat bank, independent of today's book seed format.
    rows = [
        {'id': 'u1-2', 'unitId': 'unit-1', 'unitName': '基础问候', 'spanish': 'Gracias', 'chinese': '谢谢'},
        {'id': 'u1-1', 'unitId': 'unit-1', 'unitName': '基础问候', 'spanish': 'Hola', 'chinese': '你好'},
        {'id': 'book-p009-01', 'unitId': 'book-p009', 'unitName': '教材问候', 'spanish': 'Buenos días', 'chinese': '早上好'},
    ]
    with sqlite3.connect(database) as db:
        db.execute("INSERT INTO users (id,email,password,hearts,xp,gems,streak) VALUES (1,'user@example.com','stored-hash',3,45,6,2)")
        db.executemany('INSERT INTO exercises (id,data) VALUES (?,?)', [(row['id'], json.dumps(row)) for row in rows])
        db.execute('INSERT INTO stars (user_id,exercise_id) VALUES (1,?)', (rows[0]['id'],))
    migrate('head')
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT count(*) FROM books').fetchone()[0] == 2
        assert db.execute('SELECT count(*) FROM chapters').fetchone()[0] == len({row['unitId'] for row in rows})
        assert db.execute('SELECT count(*) FROM exercises WHERE chapter_id IS NOT NULL').fetchone()[0] == len(rows)
        assert db.execute('SELECT xp,hearts,password FROM users').fetchone() == (45, 3, 'stored-hash')
        assert db.execute('SELECT count(*) FROM stars').fetchone()[0] == 1
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        assert db.execute("SELECT id,sort_order FROM exercises WHERE chapter_id='unit-1' ORDER BY sort_order").fetchall() == [('u1-1', 0), ('u1-2', 1)]
        assert db.execute('SELECT version_num FROM alembic_version').fetchone()[0] == '0003'
        assert json.loads(db.execute('SELECT data FROM exercises WHERE id=?', (rows[0]['id'],)).fetchone()[0]) == rows[0]
    migrate('head')
