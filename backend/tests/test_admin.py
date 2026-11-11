from datetime import datetime, timedelta
from unittest.mock import patch
import pytest
from sqlalchemy import select
from test_api import client
from app.admin import sync_admin, password_hash
from app.db import User, LoginSession
from app.main import app


def test_bootstrap_login_idempotence_and_password_rotation(client, monkeypatch):
    c, factory = client
    monkeypatch.setenv('ADMIN_EMAIL', 'Admin@Example.com')
    monkeypatch.setenv('ADMIN_PASSWORD', 'initial-admin-password')
    with patch('app.main.SessionLocal', factory):
        with c.__class__(app, headers={'Origin': 'http://localhost:3000'}) as bootstrapped:
            assert bootstrapped.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'initial-admin-password'}).status_code == 200
            assert bootstrapped.get('/api/me').json()['canResetData'] is True
    with factory.begin() as db:
        user = db.scalar(select(User).where(User.email == 'admin@example.com'))
        original_hash = user.password
        assert original_hash != 'initial-admin-password'
        user.xp = 42
        sync_admin(db)
        assert user.password == original_hash
        assert len(list(db.scalars(select(User)))) == 1
        db.add(LoginSession(token_hash='old', user_id=user.id, expires=datetime.utcnow() + timedelta(days=1)))
    monkeypatch.setenv('ADMIN_PASSWORD', 'updated-admin-password')
    with factory.begin() as db:
        sync_admin(db)
        user = db.scalar(select(User))
        assert password_hash.verify('updated-admin-password', user.password)
        assert user.xp == 42
        assert list(db.scalars(select(LoginSession))) == []
    assert c.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'initial-admin-password'}).status_code == 401
    assert c.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'updated-admin-password'}).status_code == 200


@pytest.mark.parametrize('email,password', [('invalid', 'long-enough-password'), ('admin@example.com', ''), ('', 'long-enough-password'), ('admin@example.com', 'short')])
def test_invalid_credentials_create_no_account(client, monkeypatch, email, password):
    _, factory = client
    monkeypatch.setenv('ADMIN_EMAIL', email)
    monkeypatch.setenv('ADMIN_PASSWORD', password)
    with factory.begin() as db:
        with pytest.raises(ValueError):
            sync_admin(db)
        assert list(db.scalars(select(User))) == []
