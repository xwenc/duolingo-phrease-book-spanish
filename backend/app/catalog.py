"""Administrator CRUD and the practice projection of the book catalog."""
from uuid import uuid4
from datetime import datetime, timezone
import json
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from pydantic import ValidationError, RootModel, Field, BaseModel, ConfigDict
from sqlalchemy import select, delete, func
from .book_format import BookInput, ChapterInput, SentenceInput, BookImport, ImportSentence, exercise_data
from .auth import current_user, require_admin
from .ordering import next_book_order
from .db import get_db, Book, Chapter, Exercise, Star, Attempt

router = APIRouter(prefix='/api/admin', dependencies=[Depends(require_admin)])
learning_router = APIRouter(prefix='/api', dependencies=[Depends(current_user)])


def find(db, model, id):
    item = db.get(model, id)
    if item is None:
        raise HTTPException(404, '内容不存在，可能已被删除')
    return item


def lock_book(db, book_id):
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update().execution_options(populate_existing=True))
    if book is None:
        raise HTTPException(404, '内容不存在，可能已被删除')
    return book


def next_chapter_order(db, book_id):
    maximum = db.scalar(select(func.max(Chapter.sort_order)).where(Chapter.book_id == book_id))
    return 0 if maximum is None else maximum + 1


def lock_chapter(db, chapter_id):
    chapter = db.scalar(select(Chapter).where(Chapter.id == chapter_id).with_for_update().execution_options(populate_existing=True))
    if chapter is None:
        raise HTTPException(404, '内容不存在，可能已被删除')
    return chapter


def next_sentence_order(db, chapter_id):
    maximum = db.scalar(select(func.max(Exercise.sort_order)).where(Exercise.chapter_id == chapter_id))
    return 0 if maximum is None else maximum + 1


def book_data(book, chapter_count=0):
    return dict(id=book.id, name=book.name, description=book.description, thumbnail=book.thumbnail, chapterCount=chapter_count)


def chapter_data(chapter, sentence_count=0):
    return dict(id=chapter.id, bookId=chapter.book_id, name=chapter.name, description=chapter.description, icon=chapter.icon, sentenceCount=sentence_count)


def sentence_data(exercise):
    data = exercise.data
    return dict(id=exercise.id, chapterId=exercise.chapter_id, name=data.get('name') or data.get('chinese', ''), imageUrl=data.get('imageUrl', ''), spanish=data['spanish'], chinese=data['chinese'], phonetics=data.get('phonetics', ''), grammarTip=data.get('grammarTip') or '', vocabHints=[dict(es=hint['es'], chinese=hint['zh']) for hint in data.get('vocabHints', [])])



def practice_exercises(db):
    rows = db.execute(select(Exercise, Chapter, Book).outerjoin(Chapter, Exercise.chapter_id == Chapter.id).outerjoin(Book, Chapter.book_id == Book.id).order_by(Book.sort_order, Book.id, Chapter.sort_order, Chapter.id, Exercise.sort_order, Exercise.id)).all()
    return [{**exercise.data, **(dict(bookId=book.id, bookTitle=book.name, bookDescription=book.description, bookThumbnail=book.thumbnail, unitId=chapter.id, unitName=chapter.name, unitIcon=chapter.icon) if chapter and book else {})} for exercise, chapter, book in rows]


@router.get('/books')
def books(db=Depends(get_db)):
    counts = dict(db.execute(select(Chapter.book_id, func.count()).group_by(Chapter.book_id)).all())
    return [book_data(book, counts.get(book.id, 0)) for book in db.scalars(select(Book).order_by(Book.sort_order, Book.id))]


@router.post('/books', status_code=201)
def create_book(body: BookInput, db=Depends(get_db)):
    book = Book(id=str(uuid4()), sort_order=next_book_order(db), **body.model_dump())
    db.add(book); db.commit()
    return book_data(book)


@router.put('/books/{book_id}')
def update_book(book_id: str, body: BookInput, db=Depends(get_db)):
    book = find(db, Book, book_id)
    for key, value in body.model_dump().items():
        setattr(book, key, value)
    db.commit()
    return book_data(book)


@router.delete('/books/{book_id}')
def delete_book(book_id: str, db=Depends(get_db)):
    book = find(db, Book, book_id)
    if db.scalar(select(Chapter.id).where(Chapter.book_id == book_id).limit(1)):
        raise HTTPException(409, '请先删除书籍中的章节')
    db.delete(book); db.commit()
    return {'deleted': True}


@router.get('/books/{book_id}/chapters')
def chapters(book_id: str, db=Depends(get_db)):
    find(db, Book, book_id)
    counts = dict(db.execute(select(Exercise.chapter_id, func.count()).group_by(Exercise.chapter_id)).all())
    return [chapter_data(chapter, counts.get(chapter.id, 0)) for chapter in db.scalars(select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.sort_order, Chapter.id))]


@router.post('/books/{book_id}/chapters', status_code=201)
def create_chapter(book_id: str, body: ChapterInput, db=Depends(get_db)):
    lock_book(db, book_id)
    chapter = Chapter(id=str(uuid4()), book_id=book_id, sort_order=next_chapter_order(db, book_id), **body.model_dump())
    db.add(chapter); db.commit()
    return chapter_data(chapter)


@router.put('/chapters/{chapter_id}')
def update_chapter(chapter_id: str, body: ChapterInput, db=Depends(get_db)):
    chapter = find(db, Chapter, chapter_id)
    for key, value in body.model_dump().items():
        setattr(chapter, key, value)
    db.commit()
    return chapter_data(chapter)


@router.delete('/chapters/{chapter_id}')
def delete_chapter(chapter_id: str, db=Depends(get_db)):
    chapter = find(db, Chapter, chapter_id)
    lock_book(db, chapter.book_id)
    lock_chapter(db, chapter_id)
    if db.scalar(select(Exercise.id).where(Exercise.chapter_id == chapter_id).limit(1)):
        raise HTTPException(409, '请先删除章节中的句子')
    db.delete(chapter); db.commit()
    return {'deleted': True}


@router.get('/chapters/{chapter_id}/sentences')
def sentences(chapter_id: str, db=Depends(get_db)):
    find(db, Chapter, chapter_id)
    return [sentence_data(exercise) for exercise in db.scalars(select(Exercise).where(Exercise.chapter_id == chapter_id).order_by(Exercise.sort_order, Exercise.id))]


@router.post('/chapters/{chapter_id}/sentences', status_code=201)
def create_sentence(chapter_id: str, body: SentenceInput, db=Depends(get_db)):
    chapter = lock_chapter(db, chapter_id)
    id = str(uuid4())
    exercise = Exercise(id=id, chapter_id=chapter_id, sort_order=next_sentence_order(db, chapter_id), data={'id': id, **exercise_data(body, chapter)})
    db.add(exercise); db.commit()
    return sentence_data(exercise)


@router.put('/sentences/{sentence_id}')
def update_sentence(sentence_id: str, body: SentenceInput, db=Depends(get_db)):
    exercise = find(db, Exercise, sentence_id)
    chapter = find(db, Chapter, exercise.chapter_id)
    exercise.data = exercise_data(body, chapter, exercise.data)
    db.commit()
    return sentence_data(exercise)


@router.delete('/sentences/{sentence_id}')
def delete_sentence(sentence_id: str, db=Depends(get_db)):
    exercise = find(db, Exercise, sentence_id)
    if exercise.chapter_id:
        lock_chapter(db, exercise.chapter_id)
    db.execute(delete(Star).where(Star.exercise_id == sentence_id))
    db.execute(delete(Attempt).where(Attempt.exercise_id == sentence_id))
    db.delete(exercise); db.commit()
    return {'deleted': True}


@learning_router.get('/catalog')
def learning_catalog(db=Depends(get_db)):
    """The learner library includes empty books/chapters, without invented client data."""
    all_chapters = list(db.scalars(select(Chapter).join(Book, Chapter.book_id == Book.id).order_by(Book.sort_order, Book.id, Chapter.sort_order, Chapter.id)))
    all_exercises = practice_exercises(db)
    chapter_counts = {}
    sentence_counts = dict(db.execute(select(Exercise.chapter_id, func.count()).group_by(Exercise.chapter_id)).all())
    for chapter in all_chapters:
        chapter_counts[chapter.book_id] = chapter_counts.get(chapter.book_id, 0) + 1
    return {
        'books': [book_data(book, chapter_counts.get(book.id, 0)) for book in db.scalars(select(Book).order_by(Book.sort_order, Book.id))],
        'chapters': [chapter_data(chapter, sentence_counts.get(chapter.id, 0)) for chapter in all_chapters],
        'exercises': all_exercises,
    }


@router.get('/books/{book_id}/export')
def export_book(book_id: str, db=Depends(get_db)):
    book = find(db, Book, book_id)
    chapters = list(db.scalars(select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.sort_order, Chapter.id)))
    exercises = db.scalars(select(Exercise).join(Chapter, Exercise.chapter_id == Chapter.id).where(Chapter.book_id == book_id).order_by(Chapter.sort_order, Chapter.id, Exercise.sort_order, Exercise.id))
    grouped = {}
    for exercise in exercises:
        sentence = sentence_data(exercise)
        sentence.pop('imageUrl', None)
        grouped.setdefault(exercise.chapter_id, []).append({**sentence, 'difficulty': exercise.data.get('difficulty', 'easy')})
    payload = {
        'format': 'habla-espanol-book',
        'version': 1,
        'exportedAt': datetime.now(timezone.utc).isoformat(),
        'book': {
            'id': book.id, 'name': book.name, 'description': book.description,
            'chapters': [
                {'id': chapter.id, 'name': chapter.name, 'description': chapter.description, 'icon': chapter.icon,
                 'sentences': grouped.get(chapter.id, [])}
                for chapter in chapters
            ],
        },
    }
    return Response(json.dumps(payload, ensure_ascii=False, indent=2), media_type='application/json', headers={
        'Content-Disposition': f"attachment; filename=book-{book.id}.json; filename*=UTF-8''{quote(book.name, safe='')}.json",
    })


@router.post('/books/import', status_code=201)
def import_book(file: UploadFile, db=Depends(get_db)):
    try:
        raw = file.file.read(5 * 1024 * 1024 + 1)
        if len(raw) > 5 * 1024 * 1024:
            raise HTTPException(413, '书籍 JSON 文件不能超过 5 MB')
        try:
            payload = json.loads(raw.decode('utf-8-sig'))
        except (ValueError, UnicodeDecodeError, RecursionError):
            raise HTTPException(400, '无法读取 JSON，请选择一键导出的 UTF-8 书籍文件')
        try:
            validated = BookImport.model_validate(payload)
        except ValidationError as error:
            raise HTTPException(422, error.errors(include_input=False, include_context=False, include_url=False))
        count = sum(len(chapter.sentences) for chapter in validated.book.chapters)
        # All validation precedes writes. A single transaction creates a fresh copy.
        source = validated.book
        try:
            book = Book(id=str(uuid4()), sort_order=next_book_order(db), name=source.name, description=source.description, thumbnail='')
            db.add(book); db.flush()
            for chapter_position, source_chapter in enumerate(source.chapters):
                chapter = Chapter(id=str(uuid4()), book_id=book.id, sort_order=chapter_position, name=source_chapter.name, description=source_chapter.description, icon=source_chapter.icon)
                db.add(chapter); db.flush()
                for position, source_sentence in enumerate(source_chapter.sentences):
                    id = str(uuid4())
                    data = {'id': id, **exercise_data(source_sentence, chapter), 'difficulty': source_sentence.difficulty, 'imageUrl': ''}
                    db.add(Exercise(id=id, chapter_id=chapter.id, sort_order=position, data=data))
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {'book': book_data(book, len(source.chapters)), 'chapterCount': len(source.chapters), 'sentenceCount': count}
    finally:
        file.file.close()


class SentenceBatch(RootModel):
    root: list[ImportSentence] = Field(min_length=1, max_length=10000)


@router.post('/chapters/{chapter_id}/sentences/import', status_code=201)
def import_sentences(chapter_id: str, file: UploadFile, db=Depends(get_db)):
    try:
        chapter = find(db, Chapter, chapter_id)
        raw = file.file.read(5 * 1024 * 1024 + 1)
        if len(raw) > 5 * 1024 * 1024:
            raise HTTPException(413, '句子 JSON 文件不能超过 5 MB')
        try:
            payload = json.loads(raw.decode('utf-8-sig'))
        except (ValueError, RecursionError):
            raise HTTPException(400, '无法读取 JSON，请选择 UTF-8 编码的句子数组文件')
        if isinstance(payload, dict) and set(payload) == {'sentences'}:
            payload = payload['sentences']
        try:
            sentences = SentenceBatch.model_validate(payload).root
        except ValidationError as error:
            issues = error.errors(include_input=False, include_context=False, include_url=False)
            messages = []
            for issue in issues[:10]:
                location = issue['loc']
                if location and isinstance(location[0], int):
                    field = '.'.join(str(part) for part in location[1:])
                    messages.append(f'第 {location[0] + 1} 个句子 {field}: {issue["msg"]}')
                else:
                    messages.append(f'句子数组: {issue["msg"]}')
            raise HTTPException(422, '；'.join(messages))
        # Validate everything first, then append with new IDs in one transaction.
        try:
            chapter = lock_chapter(db, chapter_id)
            start = next_sentence_order(db, chapter_id)
            for offset, sentence in enumerate(sentences):
                id = str(uuid4())
                data = {'id': id, **exercise_data(sentence, chapter), 'difficulty': sentence.difficulty}
                db.add(Exercise(id=id, chapter_id=chapter.id, sort_order=start + offset, data=data))
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {'chapterId': chapter.id, 'sentenceCount': len(sentences)}
    finally:
        file.file.close()


class SentenceOrder(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sentenceIds: list[str] = Field(max_length=100000)


@router.put('/chapters/{chapter_id}/sentences/order')
def reorder_sentences(chapter_id: str, body: SentenceOrder, db=Depends(get_db)):
    lock_chapter(db, chapter_id)
    if len(set(body.sentenceIds)) != len(body.sentenceIds):
        raise HTTPException(422, '句子 ID 不能重复')
    exercises = list(db.scalars(select(Exercise).where(Exercise.chapter_id == chapter_id).with_for_update()))
    by_id = {exercise.id: exercise for exercise in exercises}
    if set(body.sentenceIds) != set(by_id):
        raise HTTPException(409, '章节句子已发生变化，请重新加载列表后排序')
    for position, id in enumerate(body.sentenceIds):
        by_id[id].sort_order = position
    db.commit()
    return {'sentenceIds': body.sentenceIds}


class ChapterOrder(BaseModel):
    model_config = ConfigDict(extra='forbid')
    chapterIds: list[str] = Field(max_length=100000)


@router.put('/books/{book_id}/chapters/order')
def reorder_chapters(book_id: str, body: ChapterOrder, db=Depends(get_db)):
    lock_book(db, book_id)
    if len(set(body.chapterIds)) != len(body.chapterIds):
        raise HTTPException(422, '章节 ID 不能重复')
    chapters = list(db.scalars(select(Chapter).where(Chapter.book_id == book_id).with_for_update()))
    by_id = {chapter.id: chapter for chapter in chapters}
    if set(body.chapterIds) != set(by_id):
        raise HTTPException(409, '书籍章节已发生变化，请重新加载列表后排序')
    for position, id in enumerate(body.chapterIds):
        by_id[id].sort_order = position
    db.commit()
    return {'chapterIds': body.chapterIds}
