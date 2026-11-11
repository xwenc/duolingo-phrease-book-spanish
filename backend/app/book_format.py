"""Shared book export/import format used by the admin API and seed command."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class CatalogInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)


def validate_image_url(value):
    if value and not (value.startswith(('https://', 'http://')) or (value.startswith('/') and not value.startswith('//'))):
        raise ValueError('图片须为 http(s) 地址或站内路径')
    return value


class BookInput(CatalogInput):
    description: str = Field(default='', max_length=5000)
    thumbnail: str = Field(default='', max_length=2048)

    @field_validator('thumbnail')
    @classmethod
    def image_url(cls, value):
        return validate_image_url(value)


class ChapterInput(CatalogInput):
    description: str = Field(default='', max_length=5000)
    icon: str = Field(default='📖', min_length=1, max_length=32)


class VocabInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    es: str = Field(min_length=1, max_length=200)
    chinese: str = Field(min_length=1, max_length=500)


class SentenceInput(CatalogInput):
    imageUrl: str = Field(default='', max_length=2048)

    @field_validator('imageUrl')
    @classmethod
    def image_url(cls, value):
        return validate_image_url(value)

    spanish: str = Field(min_length=1, max_length=500)
    chinese: str = Field(min_length=1, max_length=2000)
    phonetics: str = Field(default='', max_length=2000)
    grammarTip: str = Field(default='', max_length=5000)
    vocabHints: list[VocabInput] = Field(default_factory=list, max_length=100)


class ImportSentence(SentenceInput):
    id: str | None = Field(default=None, min_length=1, max_length=64)
    chapterId: str | None = Field(default=None, max_length=64)
    difficulty: Literal['easy', 'medium', 'hard'] = 'easy'


class ImportChapter(ChapterInput):
    id: str | None = Field(default=None, min_length=1, max_length=64)
    sentences: list[ImportSentence] = Field(max_length=10000)


class ImportBook(CatalogInput):
    id: str | None = Field(default=None, min_length=1, max_length=64)
    description: str = Field(default='', max_length=5000)
    chapters: list[ImportChapter] = Field(max_length=1000)


class BookImport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    format: Literal['habla-espanol-book']
    version: Literal[1]
    exportedAt: str | None = None
    book: ImportBook

    @model_validator(mode='after')
    def validate_hierarchy(self):
        if sum(len(chapter.sentences) for chapter in self.book.chapters) > 10000:
            raise ValueError('每本书最多导入 10000 个句子')
        chapter_ids, sentence_ids = set(), set()
        for chapter in self.book.chapters:
            if chapter.id:
                if chapter.id in chapter_ids:
                    raise ValueError('章节 ID 不能重复')
                chapter_ids.add(chapter.id)
            for sentence in chapter.sentences:
                if sentence.id:
                    if sentence.id in sentence_ids:
                        raise ValueError('句子 ID 不能重复')
                    sentence_ids.add(sentence.id)
                if chapter.id and sentence.chapterId and sentence.chapterId != chapter.id:
                    raise ValueError('句子的 chapterId 与所属章节不一致')
        return self

def exercise_data(body, chapter, existing=None):
    return {**(existing or {}), 'name': body.name, 'imageUrl': body.imageUrl if 'imageUrl' in body.model_fields_set else (existing or {}).get('imageUrl', ''), 'spanish': body.spanish, 'chinese': body.chinese, 'phonetics': body.phonetics, 'grammarTip': body.grammarTip, 'unitId': chapter.id, 'unitName': chapter.name, 'vocabHints': [dict(es=hint.es, zh=hint.chinese) for hint in body.vocabHints], 'difficulty': (existing or {}).get('difficulty', 'easy')}

