"""Catalog persistence, authorization, practice projection and deletion rules."""
from test_api import client, register
from app.db import Star, Attempt, User
from sqlalchemy import select
from uuid import uuid4

BOOK = {'name': '旅行西语', 'description': '旅行中的常用表达', 'thumbnail': 'https://example.com/cover.png'}
CHAPTER = {'name': '初次见面', 'description': '问候与自我介绍', 'icon': '👋'}
SENTENCE = {'name': '打招呼', 'spanish': 'Hola amigo', 'chinese': '你好，朋友', 'phonetics': 'o-la a-mi-go', 'grammarTip': 'Hola 用于问候。', 'vocabHints': [{'es': 'Hola', 'chinese': '你好'}, {'es': 'amigo', 'chinese': '朋友'}]}


def admin(c, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL', 'test@example.com')
    register(c)


def create_tree(c):
    book = c.post('/api/admin/books', json=BOOK)
    assert book.status_code == 201, book.text
    book = book.json()
    chapter = c.post(f"/api/admin/books/{book['id']}/chapters", json=CHAPTER)
    assert chapter.status_code == 201, chapter.text
    chapter = chapter.json()
    sentence = c.post(f"/api/admin/chapters/{chapter['id']}/sentences", json=SENTENCE)
    assert sentence.status_code == 201, sentence.text
    return book, chapter, sentence.json()


def test_catalog_round_trip_rename_and_practice(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, sentence = create_tree(c)
    assert c.get('/api/admin/books').json()[0] == {**book, 'chapterCount': 1}
    assert c.get(f"/api/admin/books/{book['id']}/chapters").json()[0]['sentenceCount'] == 1
    result = c.get(f"/api/admin/chapters/{chapter['id']}/sentences").json()[0]
    assert all(result[key] == value for key, value in SENTENCE.items())
    assert c.put(f"/api/admin/books/{book['id']}", json={**BOOK, 'name': '新书名'}).status_code == 200
    assert c.put(f"/api/admin/chapters/{chapter['id']}", json={**CHAPTER, 'name': '新章节名', 'icon': '💬'}).status_code == 200
    assert c.put(f"/api/admin/sentences/{sentence['id']}", json={**SENTENCE, 'name': '新句子名', 'vocabHints': [{'es': 'amigo', 'chinese': '友人'}]}).status_code == 200
    exercise = next(ex for ex in c.get('/api/exercises').json() if ex['id'] == sentence['id'])
    assert exercise['bookTitle'] == '新书名'
    assert exercise['unitName'] == '新章节名'
    assert exercise['unitIcon'] == '💬'
    assert exercise['bookThumbnail'] == BOOK['thumbnail']
    assert exercise['name'] == '新句子名'
    assert exercise['vocabHints'] == [{'es': 'amigo', 'zh': '友人'}]
    assert c.post('/api/attempts', json={'exerciseId': sentence['id'], 'transcript': 'Hola amigo', 'requestId': str(uuid4())}).json()['evaluation']['isPassed']


def test_deletion_requires_empty_parents_and_removes_sentence_dependencies(client, monkeypatch):
    c, factory = client
    admin(c, monkeypatch)
    book, chapter, sentence = create_tree(c)
    assert c.delete(f"/api/admin/books/{book['id']}").status_code == 409
    assert c.delete(f"/api/admin/chapters/{chapter['id']}").status_code == 409
    assert c.put(f"/api/stars/{sentence['id']}?enabled=true").status_code == 200
    c.post('/api/attempts', json={'exerciseId': sentence['id'], 'transcript': 'Hola amigo', 'requestId': str(uuid4())})
    assert c.delete(f"/api/admin/sentences/{sentence['id']}").status_code == 200
    with factory() as db:
        assert list(db.scalars(select(Attempt))) == []
        assert list(db.scalars(select(Star))) == []
        assert db.scalar(select(User)).xp == 15
    assert c.delete(f"/api/admin/chapters/{chapter['id']}").status_code == 200
    assert c.delete(f"/api/admin/books/{book['id']}").status_code == 200
    assert c.get('/api/admin/books').json() == []


def test_all_catalog_routes_require_admin(client, monkeypatch):
    c, _ = client
    routes = [('GET', '/books'), ('POST', '/books'), ('PUT', '/books/missing'), ('DELETE', '/books/missing'), ('GET', '/books/missing/chapters'), ('POST', '/books/missing/chapters'), ('PUT', '/chapters/missing'), ('DELETE', '/chapters/missing'), ('GET', '/chapters/missing/sentences'), ('POST', '/chapters/missing/sentences'), ('PUT', '/sentences/missing'), ('DELETE', '/sentences/missing')]
    for method, path in routes:
        assert c.request(method, '/api/admin' + path, json=SENTENCE if 'sentence' in path else CHAPTER if 'chapter' in path else BOOK).status_code == 401
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@example.com')
    register(c)
    for method, path in routes:
        assert c.request(method, '/api/admin' + path, json=SENTENCE if 'sentence' in path else CHAPTER if 'chapter' in path else BOOK).status_code == 403


def test_validation_missing_parents_and_empty_vocab(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    assert c.post('/api/admin/books', json={**BOOK, 'name': '   '}).status_code == 422
    assert c.post('/api/admin/books', json={**BOOK, 'thumbnail': 'javascript:alert(1)'}).status_code == 422
    assert c.post('/api/admin/books/missing/chapters', json=CHAPTER).status_code == 404
    assert c.post('/api/admin/chapters/missing/sentences', json=SENTENCE).status_code == 404
    book, chapter, sentence = create_tree(c)
    path = f"/api/admin/sentences/{sentence['id']}"
    assert c.put(path, json={**SENTENCE, 'vocabHints': [{'es': '', 'chinese': '解释'}]}).status_code == 422
    assert c.put(path, json={**SENTENCE, 'vocabHints': []}).status_code == 200
    assert c.get(f"/api/admin/chapters/{chapter['id']}/sentences").json()[0]['vocabHints'] == []


def test_learner_catalog_reflects_admin_changes_and_empty_content(client, monkeypatch):
    c, _ = client
    assert c.get('/api/catalog').status_code == 401
    admin(c, monkeypatch)
    book, chapter, sentence = create_tree(c)
    empty = c.post('/api/admin/books', json={**BOOK, 'name': '空书籍'}).json()
    empty_chapter = c.post(f"/api/admin/books/{empty['id']}/chapters", json={**CHAPTER, 'name': '空章节'}).json()
    c.put(f"/api/admin/books/{book['id']}", json={**BOOK, 'name': '后台更新后的名称'})
    c.put(f"/api/admin/chapters/{chapter['id']}", json={**CHAPTER, 'icon': '✈️'})
    register(c, 'learner@example.com')
    assert c.get('/api/admin/books').status_code == 403
    catalog = c.get('/api/catalog')
    assert catalog.status_code == 200
    catalog = catalog.json()
    assert next(item for item in catalog['books'] if item['id'] == book['id'])['name'] == '后台更新后的名称'
    assert next(item for item in catalog['chapters'] if item['id'] == chapter['id'])['icon'] == '✈️'
    assert next(item for item in catalog['exercises'] if item['id'] == sentence['id'])['bookId'] == book['id']
    assert next(item for item in catalog['books'] if item['id'] == empty['id'])['chapterCount'] == 1
    assert next(item for item in catalog['chapters'] if item['id'] == empty_chapter['id'])['sentenceCount'] == 0
    assert not any(item.get('bookId') == empty['id'] for item in catalog['exercises'])


def test_export_book_contains_full_hierarchy_without_cover_or_other_books(client, monkeypatch):
    import json
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, sentence = create_tree(c)
    empty_chapter = c.post(f"/api/admin/books/{book['id']}/chapters", json={**CHAPTER, 'name': '空章节'}).json()
    other_book, other_chapter, other_sentence = create_tree(c)
    response = c.get(f"/api/admin/books/{book['id']}/export")
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('application/json')
    assert 'attachment;' in response.headers['content-disposition']
    payload = response.json()
    assert payload['version'] == 1
    assert payload['format'] == 'habla-espanol-book'
    exported = payload['book']
    assert exported['name'] == BOOK['name']
    assert exported['description'] == BOOK['description']
    assert {item['id'] for item in exported['chapters']} == {chapter['id'], empty_chapter['id']}
    exported_chapter = next(item for item in exported['chapters'] if item['id'] == chapter['id'])
    assert exported_chapter['icon'] == CHAPTER['icon']
    exported_sentence = exported_chapter['sentences'][0]
    assert exported_sentence['id'] == sentence['id']
    assert all(exported_sentence[key] == value for key, value in SENTENCE.items())
    assert next(item for item in exported['chapters'] if item['id'] == empty_chapter['id'])['sentences'] == []
    encoded = json.dumps(payload, ensure_ascii=False)
    assert 'thumbnail' not in encoded
    assert BOOK['thumbnail'] not in encoded
    assert other_book['id'] not in encoded
    assert other_sentence['id'] not in encoded
    assert c.get('/api/admin/books/missing/export').status_code == 404
    register(c, 'learner@example.com')
    assert c.get(f"/api/admin/books/{book['id']}/export").status_code == 403
    c.post('/api/logout')
    assert c.get(f"/api/admin/books/{book['id']}/export").status_code == 401


def test_export_empty_book(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book = c.post('/api/admin/books', json=BOOK).json()
    exported = c.get(f"/api/admin/books/{book['id']}/export").json()
    assert exported['book']['chapters'] == []
