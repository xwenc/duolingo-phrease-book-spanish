import test from 'node:test';
import assert from 'node:assert/strict';
import { getBooks } from './books.ts';

test('legacy exercises are isolated into imported and everyday books', () => {
  const rows = [{ id: 'book-p009-01', unitId: 'page-9' }, { id: 'u1-1', unitId: 'unit-1' }, { id: 'book-p010-01', unitId: 'page-10' }];
  const books = getBooks(rows);
  assert.deepEqual(books.map(book => book.exercises.map(ex => ex.id)), [['book-p009-01', 'book-p010-01'], ['u1-1']]);
  assert.equal(new Set(books.flatMap(book => book.exercises)).size, rows.length);
});

test('explicit book metadata supports independent books with shared units', () => {
  const books = getBooks([
    { id: 'one', unitId: 'unit-1', bookId: 'a', bookTitle: '教材 A', bookLevel: 'B1' },
    { id: 'two', unitId: 'unit-1', bookId: 'b', bookTitle: '教材 B', bookLevel: 'A2' },
  ]);
  assert.equal(books.length, 2);
  assert.equal(books[0].title, '教材 A');
  assert.equal(books[0].level, 'B1');
  assert.deepEqual(books[1].exercises.map(ex => ex.id), ['two']);
  assert.deepEqual(getBooks([]), []);
});
