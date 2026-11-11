from io import BytesIO
from PIL import Image
from test_api import client, register
import pytest


def picture(format='PNG'):
    output = BytesIO()
    Image.new('RGB', (32, 48), '#1cb0f6').save(output, format=format)
    return output.getvalue()


def test_upload_save_book_and_read_as_learner(client, monkeypatch, tmp_path):
    c, _ = client
    monkeypatch.setenv('UPLOAD_DIR', str(tmp_path))
    monkeypatch.setenv('ADMIN_EMAIL', 'test@example.com')
    register(c)
    response = c.post('/api/admin/covers', files={'file': ('../../cover.png', picture(), 'image/png')})
    assert response.status_code == 201, response.text
    url = response.json()['url']
    assert url.startswith('/api/covers/') and url.endswith('.webp')
    assert len(list(tmp_path.iterdir())) == 1
    saved = c.post('/api/admin/books', json={'name': '上传封面教材', 'thumbnail': url}).json()
    register(c, 'learner@example.com')
    cover = c.get(url)
    assert cover.status_code == 200
    assert cover.headers['content-type'] == 'image/webp'
    with Image.open(BytesIO(cover.content)) as image:
        assert image.format == 'WEBP'
        assert image.size == (32, 48)
    book = next(book for book in c.get('/api/catalog').json()['books'] if book['id'] == saved['id'])
    assert book['thumbnail'] == url
    assert c.post('/api/admin/covers', files={'file': ('cover.png', picture(), 'image/png')}).status_code == 403
    c.post('/api/logout')
    assert c.get(url).status_code == 401
    assert c.post('/api/admin/covers', files={'file': ('cover.png', picture(), 'image/png')}).status_code == 401


@pytest.mark.parametrize('format,mime', [('PNG', 'image/png'), ('JPEG', 'image/jpeg'), ('WEBP', 'image/webp')])
def test_supported_image_formats(client, monkeypatch, tmp_path, format, mime):
    c, _ = client
    monkeypatch.setenv('UPLOAD_DIR', str(tmp_path))
    monkeypatch.setenv('ADMIN_EMAIL', 'test@example.com')
    register(c)
    assert c.post('/api/admin/covers', files={'file': ('cover', picture(format), mime)}).status_code == 201


def test_reject_invalid_oversized_and_unsupported_uploads(client, monkeypatch, tmp_path):
    c, _ = client
    monkeypatch.setenv('UPLOAD_DIR', str(tmp_path))
    monkeypatch.setenv('ADMIN_EMAIL', 'test@example.com')
    register(c)
    assert c.post('/api/admin/covers', files={'file': ('bad.png', b'<script>bad</script>', 'image/png')}).status_code == 400
    assert c.post('/api/admin/covers', files={'file': ('cover.svg', b'<svg/>', 'image/svg+xml')}).status_code == 415
    assert c.post('/api/admin/covers', files={'file': ('big.png', b'x' * (5 * 1024 * 1024 + 1), 'image/png')}).status_code == 413
    assert c.get('/api/covers/not-a-cover.webp').status_code == 404
    assert c.get('/api/covers/' + '0' * 32 + '.webp').status_code == 404
    assert list(tmp_path.iterdir()) == []
