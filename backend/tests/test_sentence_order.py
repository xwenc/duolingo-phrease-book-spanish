import json
from test_api import client, register
from test_catalog import admin, create_tree, SENTENCE


def ids(c, chapter_id):
    return [item['id'] for item in c.get(f'/api/admin/chapters/{chapter_id}/sentences').json()]


def test_order_is_saved_and_used_by_practice_export_and_appends(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, first = create_tree(c)
    base = f"/api/admin/chapters/{chapter['id']}/sentences"
    second = c.post(base, json={**SENTENCE, 'name': '第二句'}).json()
    third = c.post(base, json={**SENTENCE, 'name': '第三句'}).json()
    assert ids(c, chapter['id']) == [first['id'], second['id'], third['id']]
    ordered = [third['id'], first['id'], second['id']]
    assert c.put(base + '/order', json={'sentenceIds': ordered}).status_code == 200
    assert ids(c, chapter['id']) == ordered
    assert [ex['id'] for ex in c.get('/api/exercises').json() if ex.get('unitId') == chapter['id']] == ordered
    assert [ex['id'] for ex in c.get('/api/catalog').json()['exercises'] if ex.get('unitId') == chapter['id']] == ordered
    exported = c.get(f"/api/admin/books/{book['id']}/export").json()
    assert [ex['id'] for ex in exported['book']['chapters'][0]['sentences']] == ordered
    imported = c.post('/api/admin/books/import', files={'file': ('book.json', json.dumps(exported).encode(), 'application/json')}).json()
    copied_chapter = c.get(f"/api/admin/books/{imported['book']['id']}/chapters").json()[0]
    assert [ex['name'] for ex in c.get(f"/api/admin/chapters/{copied_chapter['id']}/sentences").json()] == ['第三句', SENTENCE['name'], '第二句']
    fourth = c.post(base, json={**SENTENCE, 'name': '第四句'}).json()
    payload = [{**SENTENCE, 'name': '批量第一句'}, {**SENTENCE, 'name': '批量第二句'}]
    assert c.post(base + '/import', files={'file': ('sentences.json', json.dumps(payload).encode(), 'application/json')}).status_code == 201
    saved = c.get(base).json()
    assert [ex['id'] for ex in saved[:4]] == ordered + [fourth['id']]
    assert [ex['name'] for ex in saved[4:]] == ['批量第一句', '批量第二句']
    c.delete(f"/api/admin/sentences/{first['id']}")
    assert ids(c, chapter['id']) == [ex['id'] for ex in saved if ex['id'] != first['id']]


def test_order_rejects_duplicates_foreign_ids_and_stale_lists(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    _, chapter, sentence = create_tree(c)
    _, other_chapter, other_sentence = create_tree(c)
    path = f"/api/admin/chapters/{chapter['id']}/sentences/order"
    assert c.put(path, json={'sentenceIds': [sentence['id'], sentence['id']]}).status_code == 422
    for invalid in [[], [other_sentence['id']], [sentence['id'], 'missing']]:
        assert c.put(path, json={'sentenceIds': invalid}).status_code == 409
    assert ids(c, chapter['id']) == [sentence['id']]
    assert ids(c, other_chapter['id']) == [other_sentence['id']]
    assert c.put('/api/admin/chapters/missing/sentences/order', json={'sentenceIds': []}).status_code == 404
    register(c, 'learner@example.com')
    assert c.put(path, json={'sentenceIds': [sentence['id']]}).status_code == 403
    c.post('/api/logout')
    assert c.put(path, json={'sentenceIds': [sentence['id']]}).status_code == 401
