import json
from test_api import client, register
from test_catalog import admin, create_tree, CHAPTER, SENTENCE


def chapter_ids(c, book_id):
    return [chapter['id'] for chapter in c.get(f'/api/admin/books/{book_id}/chapters').json()]


def test_chapter_order_persists_across_catalog_practice_export_import_and_creation(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book, first, first_sentence = create_tree(c)
    base = f"/api/admin/books/{book['id']}/chapters"
    second = c.post(base, json={**CHAPTER, 'name': '第二章'}).json()
    second_sentence = c.post(f"/api/admin/chapters/{second['id']}/sentences", json=SENTENCE).json()
    third = c.post(base, json={**CHAPTER, 'name': '第三章（空章节）'}).json()
    assert chapter_ids(c, book['id']) == [first['id'], second['id'], third['id']]
    ordered = [third['id'], second['id'], first['id']]
    assert c.put(base + '/order', json={'chapterIds': ordered}).status_code == 200
    assert chapter_ids(c, book['id']) == ordered
    catalog = c.get('/api/catalog').json()
    assert [chapter['id'] for chapter in catalog['chapters'] if chapter['bookId'] == book['id']] == ordered
    assert [ex['id'] for ex in catalog['exercises'] if ex.get('bookId') == book['id']] == [second_sentence['id'], first_sentence['id']]
    exported = c.get(f"/api/admin/books/{book['id']}/export").json()
    assert [chapter['id'] for chapter in exported['book']['chapters']] == ordered
    imported = c.post('/api/admin/books/import', files={'file': ('book.json', json.dumps(exported).encode(), 'application/json')}).json()
    names = [chapter['name'] for chapter in c.get(f"/api/admin/books/{imported['book']['id']}/chapters").json()]
    assert names == [third['name'], second['name'], first['name']]
    fourth = c.post(base, json={**CHAPTER, 'name': '新增章节'}).json()
    assert chapter_ids(c, book['id']) == ordered + [fourth['id']]
    assert c.delete(f"/api/admin/chapters/{third['id']}").status_code == 200
    assert chapter_ids(c, book['id']) == [second['id'], first['id'], fourth['id']]


def test_chapter_order_rejects_invalid_lists_and_requires_admin(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, _ = create_tree(c)
    other_book, other_chapter, _ = create_tree(c)
    path = f"/api/admin/books/{book['id']}/chapters/order"
    assert c.put(path, json={'chapterIds': [chapter['id'], chapter['id']]}).status_code == 422
    for invalid in [[], [other_chapter['id']], [chapter['id'], 'missing']]:
        assert c.put(path, json={'chapterIds': invalid}).status_code == 409
    assert chapter_ids(c, book['id']) == [chapter['id']]
    assert chapter_ids(c, other_book['id']) == [other_chapter['id']]
    assert c.put('/api/admin/books/missing/chapters/order', json={'chapterIds': []}).status_code == 404
    register(c, 'learner@example.com')
    assert c.put(path, json={'chapterIds': [chapter['id']]}).status_code == 403
    c.post('/api/logout')
    assert c.put(path, json={'chapterIds': [chapter['id']]}).status_code == 401
