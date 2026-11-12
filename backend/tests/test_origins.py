from test_api import client


def test_explicit_local_and_lan_origins_are_allowed(client, monkeypatch):
    c, _ = client
    monkeypatch.setenv('APP_ORIGIN', 'http://192.168.0.102:3000')
    monkeypatch.setenv('APP_ORIGINS', ' http://localhost:3000, http://127.0.0.1:3000, ')
    for origin in ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.0.102:3000']:
        assert c.post('/api/logout', headers={'Origin': origin}).status_code == 200
    for origin in ['', 'https://evil.example', 'http://localhost:4000', 'https://localhost:3000', 'http://192.168.0.103:3000']:
        assert c.post('/api/logout', headers={'Origin': origin}).status_code == 403


def test_without_extra_origins_only_primary_origin_is_accepted(client, monkeypatch):
    c, _ = client
    monkeypatch.setenv('APP_ORIGIN', 'http://localhost:3000')
    monkeypatch.delenv('APP_ORIGINS', raising=False)
    assert c.post('/api/logout', headers={'Origin': 'http://localhost:3000'}).status_code == 200
    assert c.post('/api/logout', headers={'Origin': 'http://127.0.0.1:3000'}).status_code == 403
