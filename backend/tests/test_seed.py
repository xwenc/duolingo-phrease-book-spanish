import json
from copy import deepcopy
import pytest
from sqlalchemy import select, func
from test_api import client
from app.db import Book, Chapter, Exercise, User, Star, Attempt
from app.seed import load_book, sync_book


def test_default_book_seed_is_idempotent_and_updates_all_fields(client):
    _, factory = client
    payload = load_book()
    count = sum(len(ch.sentences) for ch in payload.book.chapters)
    assert (len(payload.book.chapters), count) == (6, 23)
    with factory.begin() as db:
        result = sync_book(db, payload)
        assert result['books']['inserted'] == 1
        assert result['chapters']['inserted'] == 6
        assert result['sentences']['inserted'] == count
        db.get(Book, payload.book.id).thumbnail = '/existing-cover.webp'
        image_exercise = db.get(Exercise, payload.book.chapters[0].sentences[0].id)
        image_exercise.data = {**image_exercise.data, 'imageUrl': '/existing-sentence.webp'}
        user = User(email='existing@example.com', password='stored-hash', xp=77)
        db.add(user); db.flush()
        exercise_id = payload.book.chapters[0].sentences[0].id
        db.add(Star(user_id=user.id, exercise_id=exercise_id))
        db.add(Attempt(user_id=user.id, exercise_id=exercise_id, request_id='seed-preserved-attempt', result={'isPassed': True}))
    with factory.begin() as db:
        assert all(stats == {'inserted': 0, 'updated': 0} for stats in sync_book(db, payload).values())
        assert db.scalar(select(User)).xp == 77
        assert db.scalar(select(func.count()).select_from(Star)) == 1
        assert db.scalar(select(func.count()).select_from(Attempt)) == 1
    data = payload.model_dump()
    data['book']['name'] = '更新书名'
    data['book']['chapters'][0]['name'] = '更新章节'
    sentence = data['book']['chapters'][0]['sentences'][0]
    sentence['chinese'] = '更新中文'
    sentence['vocabHints'] = [{'es': 'nuevo', 'chinese': '新的'}]
    with factory.begin() as db:
        result = sync_book(db, data)
        assert result['books']['updated'] == result['chapters']['updated'] == 1
        saved = db.get(Exercise, sentence['id'])
        assert saved.data['chinese'] == '更新中文'
        assert saved.data['unitName'] == '更新章节'
        assert saved.data['vocabHints'] == [{'es': 'nuevo', 'zh': '新的'}]
        assert db.get(Book, payload.book.id).thumbnail == '/existing-cover.webp'
        assert saved.data['imageUrl'] == '/existing-sentence.webp'
        assert db.get(Exercise, 'one') is not None


def test_seed_rejects_duplicates_mismatched_hierarchy_and_legacy_format(tmp_path):
    data = load_book().model_dump()
    invalids = [[], {'format': 'habla-espanol-book', 'version': 2, 'book': data['book']}]
    duplicate = deepcopy(data)
    duplicate['book']['chapters'].append(deepcopy(duplicate['book']['chapters'][0]))
    invalids.append(duplicate)
    wrong_chapter = deepcopy(data)
    wrong_chapter['book']['chapters'][0]['sentences'][0]['chapterId'] = 'wrong'
    invalids.append(wrong_chapter)
    for invalid in invalids:
        file = tmp_path / 'invalid.json'
        file.write_text(json.dumps(invalid))
        with pytest.raises(ValueError):
            load_book(file)


def test_collision_rolls_back_and_missing_ids_are_stable(client):
    _, factory = client
    payload = load_book()
    with factory.begin() as db:
        sync_book(db, payload)
    collision = payload.model_dump()
    collision['book']['id'] = 'another-book'
    with pytest.raises(ValueError, match='其他书籍'):
        with factory.begin() as db:
            sync_book(db, collision)
    with factory() as db:
        assert db.get(Book, 'another-book') is None
    missing_ids = {'format': 'habla-espanol-book', 'version': 1, 'book': {'name': '无 ID 教材', 'chapters': [{'name': '问候', 'sentences': [{'name': '你好', 'spanish': 'Hola', 'chinese': '你好', 'vocabHints': []}]}]}}
    with factory.begin() as db:
        assert sync_book(db, missing_ids)['sentences']['inserted'] == 1
    with factory.begin() as db:
        assert all(stats == {'inserted': 0, 'updated': 0} for stats in sync_book(db, missing_ids).values())
