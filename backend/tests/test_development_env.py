import os
from pathlib import Path
import subprocess
import sys
import pytest
from dev import load_development_env


def test_development_file_loads_before_app_imports_from_any_directory(tmp_path):
    config = tmp_path / '.env.development.local'
    config.write_text("DATABASE_URL='sqlite://'\nCOOKIE_SECURE=false\nADMIN_PASSWORD='literal-$VALUE#password'\n")
    env = {key: value for key, value in os.environ.items() if key not in ('DATABASE_URL', 'COOKIE_SECURE', 'ADMIN_PASSWORD')}
    backend = Path(__file__).resolve().parents[1]
    env['PYTHONPATH'] = str(backend)
    result = subprocess.run([sys.executable, '-c', 'from dev import load_development_env; import os; load_development_env(__import__("sys").argv[1]); from app.db import engine; assert str(engine.url) == "sqlite://"; assert os.environ["COOKIE_SECURE"] == "false"; assert os.environ["ADMIN_PASSWORD"] == "literal-$VALUE#password"', str(config)], cwd=tmp_path, env=env, capture_output=True)
    assert result.returncode == 0, result.stderr.decode()


def test_shell_environment_takes_priority(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'sqlite://')
    config = tmp_path / '.env.development.local'
    config.write_text('DATABASE_URL=mysql+pymysql://unused\n')
    load_development_env(config)
    assert os.environ['DATABASE_URL'] == 'sqlite://'


def test_missing_file_and_missing_database_are_reported(tmp_path, monkeypatch):
    with pytest.raises(ValueError, match='缺少'):
        load_development_env(tmp_path / 'missing')
    monkeypatch.delenv('DATABASE_URL', raising=False)
    config = tmp_path / '.env.development.local'
    config.write_text('# Empty local configuration\n')
    with pytest.raises(ValueError, match='DATABASE_URL'):
        load_development_env(config)


def test_serve_migrates_before_starting_api(monkeypatch):
    import dev
    calls = []
    monkeypatch.setattr(dev, 'load_development_env', lambda: None)
    monkeypatch.setattr(dev.os, 'chdir', lambda path: None)
    monkeypatch.setattr(dev.sys, 'argv', ['dev.py'])
    monkeypatch.setattr(dev.subprocess, 'run', lambda command, **kwargs: calls.append(('migrate', command, kwargs)))
    monkeypatch.setattr(dev.os, 'execv', lambda executable, command: calls.append(('serve', command)))
    dev.main()
    assert calls[0][0] == 'migrate'
    assert calls[0][1][1:] == ['-m', 'alembic', 'upgrade', 'head']
    assert calls[0][2]['check'] is True
    assert calls[1][0] == 'serve'
    assert calls[1][1][1:4] == ['-m', 'uvicorn', 'app.main:app']
    assert not any('app.seed' in call[1] for call in calls)


def test_failed_migration_does_not_start_api(monkeypatch):
    import dev
    monkeypatch.setattr(dev, 'load_development_env', lambda: None)
    monkeypatch.setattr(dev.os, 'chdir', lambda path: None)
    monkeypatch.setattr(dev.sys, 'argv', ['dev.py'])
    def fail(command, **kwargs):
        raise subprocess.CalledProcessError(1, command)
    monkeypatch.setattr(dev.subprocess, 'run', fail)
    monkeypatch.setattr(dev.os, 'execv', lambda *args: pytest.fail('API must not start after a failed migration'))
    with pytest.raises(SystemExit) as error:
        dev.main()
    assert error.value.code == 1
