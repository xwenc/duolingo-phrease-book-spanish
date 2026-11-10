"""Validate and synchronize the versioned question bank without resetting accounts."""
import json
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .db import SessionLocal, Exercise

class VocabHint(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    es: str = Field(min_length=1)
    zh: str = Field(min_length=1)

class ExerciseSeed(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    id: str = Field(min_length=1, max_length=64)
    unitId: str = Field(min_length=1)
    unitName: str = Field(min_length=1)
    spanish: str = Field(min_length=1)
    chinese: str = Field(min_length=1)
    phonetics: str = Field(min_length=1)
    grammarTip: str | None = None
    vocabHints: list[VocabHint] = Field(min_length=1)
    difficulty: Literal['easy', 'medium', 'hard']

def load_exercises(path=None):
    rows = json.loads((Path(path) if path else Path(__file__).with_name('exercises.json')).read_text())
    if not isinstance(rows, list) or not rows:
        raise ValueError('Seed must be a non-empty exercise array')
    validated = [ExerciseSeed.model_validate(row).model_dump(exclude_unset=True) for row in rows]
    if len({row['id'] for row in validated}) != len(validated):
        raise ValueError('Duplicate exercise IDs in seed')
    return validated

def sync_exercises(db, rows):
    inserted = updated = 0
    for row in rows:
        exercise = db.get(Exercise, row['id'])
        if exercise is None:
            db.add(Exercise(id=row['id'], data=row))
            inserted += 1
        elif exercise.data != row:
            exercise.data = row
            updated += 1
    db.flush()
    return {'inserted': inserted, 'updated': updated}

def main():
    rows = load_exercises()
    with SessionLocal.begin() as db:
        result = sync_exercises(db, rows)
    print(f"Seed synchronized: {result['inserted']} inserted, {result['updated']} updated")

if __name__ == '__main__':
    main()
