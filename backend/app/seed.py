"""Idempotently synchronize a book export without deleting accounts or practice data."""
import argparse
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from .book_format import BookImport, exercise_data
from .db import SessionLocal, Exercise, Book, Chapter
from .ordering import next_book_order

DEFAULT_BOOK = Path(__file__).with_name('西班牙语 · 日常口语.json')


def load_book(path=None):
    """Validate the complete exported book before opening a write transaction."""
    with (Path(path) if path else DEFAULT_BOOK).open('rb') as file:
        raw = file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise ValueError('书籍 JSON 文件不能超过 5 MB')
    return BookImport.model_validate(json.loads(raw.decode('utf-8-sig')))


def stable_id(value):
    return str(uuid5(NAMESPACE_URL, f'habla-espanol-seed:{value}'))


def sync_book(db, payload):
    """Preserve exported IDs; reject collisions with another book's content."""
    payload = BookImport.model_validate(payload)
    source = payload.book
    book_id = source.id or stable_id(source.name)
    resolved_chapters, resolved_sentences = set(), set()
    for chapter_index, chapter in enumerate(source.chapters):
        chapter_id = chapter.id or stable_id(f'{book_id}/chapter/{chapter_index}')
        if chapter_id in resolved_chapters:
            raise ValueError('生成后的章节 ID 与已有章节 ID 重复')
        resolved_chapters.add(chapter_id)
        for sentence_index, sentence in enumerate(chapter.sentences):
            id = sentence.id or stable_id(f'{book_id}/{chapter_id}/sentence/{sentence_index}')
            if id in resolved_sentences:
                raise ValueError('生成后的句子 ID 与已有句子 ID 重复')
            resolved_sentences.add(id)
    result = {kind: {'inserted': 0, 'updated': 0} for kind in ('books', 'chapters', 'sentences')}

    def upsert(model, id, values, kind):
        item = db.get(model, id)
        if item is None:
            item = model(id=id, **values)
            db.add(item)
            result[kind]['inserted'] += 1
        elif any(getattr(item, key) != value for key, value in values.items()):
            for key, value in values.items():
                setattr(item, key, value)
            result[kind]['updated'] += 1
        db.flush()
        return item

    # No thumbnail in the export: preserve any existing cover, leave new covers empty.
    book_values = {'name': source.name, 'description': source.description}
    if db.get(Book, book_id) is None:
        book_values['sort_order'] = next_book_order(db)
    upsert(Book, book_id, book_values, 'books')
    for chapter_index, source_chapter in enumerate(source.chapters):
        chapter_id = source_chapter.id or stable_id(f'{book_id}/chapter/{chapter_index}')
        existing_chapter = db.get(Chapter, chapter_id)
        if existing_chapter and existing_chapter.book_id != book_id:
            raise ValueError(f'章节 ID {chapter_id} 已属于其他书籍，未导入任何数据')
        chapter = upsert(Chapter, chapter_id, {'book_id': book_id, 'sort_order': chapter_index, 'name': source_chapter.name,
                         'description': source_chapter.description, 'icon': source_chapter.icon}, 'chapters')
        for sentence_index, sentence in enumerate(source_chapter.sentences):
            id = sentence.id or stable_id(f'{book_id}/{chapter_id}/sentence/{sentence_index}')
            existing = db.get(Exercise, id)
            if existing and existing.chapter_id:
                owner = db.get(Chapter, existing.chapter_id)
                if owner and owner.book_id != book_id:
                    raise ValueError(f'句子 ID {id} 已属于其他书籍，未导入任何数据')
            data = {'id': id, **exercise_data(sentence, chapter), 'difficulty': sentence.difficulty,
                    'imageUrl': existing.data.get('imageUrl', '') if existing else ''}
            upsert(Exercise, id, {'chapter_id': chapter_id, 'sort_order': sentence_index, 'data': data}, 'sentences')
    return result


def main():
    parser = argparse.ArgumentParser(description='按导出格式幂等同步书籍，默认 app/西班牙语 · 日常口语.json')
    parser.add_argument('--file', type=Path, default=DEFAULT_BOOK, help='书籍导出 JSON 文件路径')
    args = parser.parse_args()
    try:
        payload = load_book(args.file)
        with SessionLocal.begin() as db:
            result = sync_book(db, payload)
    except (ValueError, OSError, RecursionError) as error:
        parser.exit(1, f'Seed 导入失败：{error}\n')
    print(f'Seed synchronized: {json.dumps(result, ensure_ascii=False)}')


if __name__ == '__main__':
    main()
