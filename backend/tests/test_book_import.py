from copy import deepcopy
import json
import pytest
from sqlalchemy import select, func
from test_api import client
from test_catalog import admin, create_tree
from app.db import Book, Chapter, Exercise


def upload(c, payload):
    return c.post('/api/admin/books/import', files={'file': ('book.json', json.dumps(payload, ensure_ascii=False).encode('utf-8'), 'application/json')})


def test_export_import_round_trip_and_repeat_creates_independent_copies(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, sentence = create_tree(c)
    empty = c.post(f"/api/admin/books/{book['id']}/chapters", json={'name': '空章节', 'description': '稍后补充', 'icon': '✈️'}).json()
    original = c.get(f"/api/admin/books/{book['id']}/export").json()
    for source_chapter in original['book']['chapters']:
        for source_sentence in source_chapter['sentences']:
            source_sentence['difficulty'] = 'hard'
    for _ in range(2):
        result = upload(c, original)
        assert result.status_code == 201, result.text
        result = result.json()
        assert result['chapterCount'] == 2
        assert result['sentenceCount'] == 1
        imported = result['book']
        assert imported['id'] != book['id']
        assert imported['thumbnail'] == ''
        copied = c.get(f"/api/admin/books/{imported['id']}/export").json()['book']
        assert copied['name'] == original['book']['name']
        assert {item['name'] for item in copied['chapters']} == {chapter['name'], empty['name']}
        sentences = [item for ch in copied['chapters'] for item in ch['sentences']]
        assert len(sentences) == 1
        assert sentences[0]['id'] != sentence['id']
        assert sentences[0]['chapterId'] != chapter['id']
        assert sentences[0]['difficulty'] == 'hard'
        assert sentences[0]['vocabHints'] == sentence['vocabHints']
        assert sentences[0]['spanish'] == sentence['spanish']
    assert len(c.get('/api/admin/books').json()) == 3
    assert c.get(f"/api/admin/books/{book['id']}/export").json()['book'] == {**original['book'], 'chapters': [{**ch, 'sentences': [{**item, 'difficulty': 'easy'} for item in ch['sentences']]} for ch in original['book']['chapters']]}


def test_invalid_book_is_rejected_before_any_writes(client, monkeypatch):
    c, factory = client
    admin(c, monkeypatch)
    book, _, _ = create_tree(c)
    original = c.get(f"/api/admin/books/{book['id']}/export").json()
    invalid = deepcopy(original)
    chapter = next(ch for ch in invalid['book']['chapters'] if ch['sentences'])
    chapter['sentences'].append({**chapter['sentences'][0], 'spanish': '   '})
    assert upload(c, invalid).status_code == 422
    assert upload(c, {**original, 'version': 2}).status_code == 422
    assert c.post('/api/admin/books/import', files={'file': ('bad.json', b'{invalid', 'application/json')}).status_code == 400
    assert c.post('/api/admin/books/import', files={'file': ('big.json', b'x' * (5 * 1024 * 1024 + 1), 'application/json')}).status_code == 413
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Book)) == 1
        assert db.scalar(select(func.count()).select_from(Chapter)) == 1
        assert db.scalar(select(func.count()).select_from(Exercise)) == 2  # Includes fixture exercise.


def test_mid_transaction_error_rolls_back_everything(client, monkeypatch):
    import app.catalog as catalog
    c, factory = client
    admin(c, monkeypatch)
    book, _, _ = create_tree(c)
    payload = c.get(f"/api/admin/books/{book['id']}/export").json()
    def fail(*args, **kwargs):
        raise RuntimeError('Simulated write failure')
    monkeypatch.setattr(catalog, 'exercise_data', fail)
    with pytest.raises(RuntimeError, match='Simulated write failure'):
        upload(c, payload)
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Book)) == 1
        assert db.scalar(select(func.count()).select_from(Chapter)) == 1


def test_import_authorization_and_empty_book(client, monkeypatch):
    from test_api import register
    c, _ = client
    payload = {'format': 'habla-espanol-book', 'version': 1, 'book': {'name': '空教材', 'chapters': []}}
    assert upload(c, payload).status_code == 401
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@example.com')
    register(c)
    assert upload(c, payload).status_code == 403
    monkeypatch.setenv('ADMIN_EMAIL', 'test@example.com')
    result = upload(c, payload)
    assert result.status_code == 201
    assert result.json()['chapterCount'] == result.json()['sentenceCount'] == 0
