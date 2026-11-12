import json
from sqlalchemy import select
from test_api import client
from test_catalog import admin, BOOK, CHAPTER, SENTENCE
from app.db import Book
from app.seed import sync_book


def test_new_and_imported_books_are_last_even_when_ids_sort_first(client, monkeypatch):
    import app.catalog as catalog
    c, _ = client
    admin(c, monkeypatch)
    ids = iter(['z-first', 'a-second', 'm-third', '000-imported'])
    monkeypatch.setattr(catalog, 'uuid4', lambda: next(ids))
    books = [c.post('/api/admin/books', json={**BOOK, 'name': name}).json() for name in ['第一本', '第二本', '第三本']]
    exported = c.get(f"/api/admin/books/{books[0]['id']}/export").json()
    copied = c.post('/api/admin/books/import', files={'file': ('book.json', json.dumps(exported).encode(), 'application/json')}).json()['book']
    expected = [item['id'] for item in books] + [copied['id']]
    assert [item['id'] for item in c.get('/api/admin/books').json()] == expected
    assert [item['id'] for item in c.get('/api/catalog').json()['books']] == expected
    c.put(f"/api/admin/books/{books[0]['id']}", json={**BOOK, 'name': '修改名称'})
    assert [item['id'] for item in c.get('/api/admin/books').json()] == expected


def test_new_chapter_and_sentence_follow_existing_manual_order(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book = c.post('/api/admin/books', json=BOOK).json()
    chapter_path = f"/api/admin/books/{book['id']}/chapters"
    first, second = [c.post(chapter_path, json=CHAPTER).json() for _ in range(2)]
    c.put(chapter_path + '/order', json={'chapterIds': [second['id'], first['id']]})
    last = c.post(chapter_path, json=CHAPTER).json()
    assert [item['id'] for item in c.get(chapter_path).json()] == [second['id'], first['id'], last['id']]
    sentence_path = f"/api/admin/chapters/{first['id']}/sentences"
    a, b = [c.post(sentence_path, json=SENTENCE).json() for _ in range(2)]
    c.put(sentence_path + '/order', json={'sentenceIds': [b['id'], a['id']]})
    last_sentence = c.post(sentence_path, json=SENTENCE).json()
    assert [item['id'] for item in c.get(sentence_path).json()] == [b['id'], a['id'], last_sentence['id']]


def test_seed_appends_new_book_and_preserves_existing_book_position(client):
    _, factory = client
    payload = {'format': 'habla-espanol-book', 'version': 1, 'book': {'id': 'a-new', 'name': '新书', 'chapters': []}}
    with factory.begin() as db:
        db.add(Book(id='z-existing', name='已有书籍', sort_order=8))
    with factory.begin() as db:
        sync_book(db, payload)
        assert db.get(Book, 'a-new').sort_order == 9
    with factory.begin() as db:
        payload['book']['name'] = '改名'
        sync_book(db, payload)
        assert db.get(Book, 'a-new').sort_order == 9
        assert db.get(Book, 'z-existing').sort_order == 8
