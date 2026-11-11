import os
from pathlib import Path
import subprocess


def run_start(tmp_path, fail_migration=False):
    commands = tmp_path / 'bin'
    commands.mkdir()
    log = tmp_path / 'commands.log'
    for name in ('python', 'uvicorn'):
        script = commands / name
        script.write_text('#!/bin/sh\nprintf "%s\\n" "' + name + ' $*" >> "$STARTUP_LOG"\n' + ('exit 1\n' if name == 'python' and fail_migration else 'exit 0\n'))
        script.chmod(0o755)
    env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'], 'STARTUP_LOG': str(log)}
    result = subprocess.run(['sh', str(Path(__file__).resolve().parents[1] / 'start-api.sh')], env=env, capture_output=True)
    return result, log.read_text().splitlines()


def test_container_migrates_before_serving_without_seed(tmp_path):
    result, commands = run_start(tmp_path)
    assert result.returncode == 0
    assert commands[0] == 'python -m alembic upgrade head'
    assert commands[1].startswith('uvicorn app.main:app ')
    assert len(commands) == 2


def test_container_does_not_serve_after_failed_migration(tmp_path):
    result, commands = run_start(tmp_path, fail_migration=True)
    assert result.returncode == 1
    assert commands == ['python -m alembic upgrade head']
