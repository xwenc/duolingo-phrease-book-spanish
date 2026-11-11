import json
import pytest
from sqlalchemy import select, func
from test_api import client, register
from test_catalog import admin, create_tree, SENTENCE
from app.db import Exercise


def upload(c, chapter_id, payload):
    return c.post(f'/api/admin/chapters/{chapter_id}/sentences/import', files={'file': ('sentences.json', json.dumps(payload, ensure_ascii=False).encode('utf-8'), 'application/json')})


@pytest.mark.parametrize('wrapped', [False, True])
def test_append_sentences_to_selected_chapter_with_new_ids(client, monkeypatch, wrapped):
    c, _ = client
    admin(c, monkeypatch)
    book, chapter, existing = create_tree(c)
    other_book, other_chapter, _ = create_tree(c)
    values = [{**SENTENCE, 'id': existing['id'], 'chapterId': other_chapter['id'], 'difficulty': 'hard', 'imageUrl': '/api/covers/example.webp'}, {'name': '致谢', 'spanish': 'Gracias.', 'chinese': '谢谢。'}]
    result = upload(c, chapter['id'], {'sentences': values} if wrapped else values)
    assert result.status_code == 201, result.text
    assert result.json() == {'chapterId': chapter['id'], 'sentenceCount': 2}
    saved = c.get(f"/api/admin/chapters/{chapter['id']}/sentences").json()
    assert len(saved) == 3
    assert any(item['id'] == existing['id'] for item in saved)
    imported = [item for item in saved if item['id'] != existing['id']]
    assert all(item['chapterId'] == chapter['id'] for item in imported)
    assert len({item['id'] for item in imported}) == 2
    assert len(c.get(f"/api/admin/chapters/{other_chapter['id']}/sentences").json()) == 1
    catalog = c.get('/api/catalog').json()
    matches = [item for item in catalog['exercises'] if item['id'] in {item['id'] for item in imported}]
    assert all(item['bookId'] == book['id'] for item in matches)
    full = next(item for item in matches if item['name'] == SENTENCE['name'])
    assert full['difficulty'] == 'hard'
    assert full['imageUrl'] == '/api/covers/example.webp'
    assert full['vocabHints'] == [{'es': hint['es'], 'zh': hint['chinese']} for hint in SENTENCE['vocabHints']]


def test_invalid_sentence_rejects_entire_batch_with_row_number(client, monkeypatch):
    c, _ = client
    admin(c, monkeypatch)
    _, chapter, existing = create_tree(c)
    response = upload(c, chapter['id'], [SENTENCE, {**SENTENCE, 'spanish': '  '}])
    assert response.status_code == 422
    assert '第 2 个句子 spanish' in response.json()['detail']
    for invalid in [[], {'name': 'not an array'}, [SENTENCE, 'invalid'], [{**SENTENCE, 'difficulty': 'unknown'}]]:
        assert upload(c, chapter['id'], invalid).status_code == 422
    assert c.get(f"/api/admin/chapters/{chapter['id']}/sentences").json() == [existing]


def test_file_errors_missing_chapter_and_permissions(client, monkeypatch):
    c, _ = client
    assert upload(c, 'missing', [SENTENCE]).status_code == 401
    admin(c, monkeypatch)
    _, chapter, _ = create_tree(c)
    path = f"/api/admin/chapters/{chapter['id']}/sentences/import"
    assert upload(c, 'missing', [SENTENCE]).status_code == 404
    assert c.post(path, files={'file': ('bad.json', b'{broken', 'application/json')}).status_code == 400
    assert c.post(path, files={'file': ('big.json', b'x' * (5 * 1024 * 1024 + 1), 'application/json')}).status_code == 413
    register(c, 'learner@example.com')
    assert upload(c, chapter['id'], [SENTENCE]).status_code == 403


def test_database_error_rolls_back_all_appended_sentences(client, monkeypatch):
    import app.catalog as catalog
    c, factory = client
    admin(c, monkeypatch)
    _, chapter, existing = create_tree(c)
    original = catalog.exercise_data
    calls = 0
    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError('Simulated failure')
        return original(*args, **kwargs)
    monkeypatch.setattr(catalog, 'exercise_data', fail_second)
    with pytest.raises(RuntimeError, match='Simulated failure'):
        upload(c, chapter['id'], [SENTENCE, SENTENCE])
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Exercise).where(Exercise.chapter_id == chapter['id'])) == 1
