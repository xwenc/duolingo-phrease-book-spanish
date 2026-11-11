import test from 'node:test';
import assert from 'node:assert/strict';
import { getBooks } from './books.ts';

const catalogBook = (id, name) => ({ id, name, description: '服务器描述', thumbnail: '/cover.png', chapterCount: 1 });

test('library uses server books and retains empty books and chapters', () => {
  const catalog = {
    books: [catalogBook('a', '后台教材'), catalogBook('empty', '尚未添加句子的教材')],
    chapters: [{ id: 'chapter', bookId: 'empty', name: '空章节', description: '', icon: '✈️', sentenceCount: 0 }],
    exercises: [{ id: 'book-legacy-prefix', bookId: 'a', unitId: 'other' }],
  };
  const books = getBooks(catalog);
  assert.equal(books.length, 2);
  assert.equal(books[0].title, '后台教材');
  assert.equal(books[0].description, '服务器描述');
  assert.equal(books[0].thumbnail, '/cover.png');
  assert.equal(books[0].level, undefined);
  assert.deepEqual(books[0].exercises.map(ex => ex.id), ['book-legacy-prefix']);
  assert.equal(books[1].chapters[0].icon, '✈️');
  assert.deepEqual(books[1].exercises, []);
});

test('unassigned exercises never fabricate books or cross book boundaries', () => {
  const books = getBooks({
    books: [catalogBook('a', '教材 A'), catalogBook('b', '教材 B')],
    chapters: [],
    exercises: [{ id: 'one', bookId: 'b' }, { id: 'u1-1' }, { id: 'book-p009-01' }],
  });
  assert.deepEqual(books[0].exercises, []);
  assert.deepEqual(books[1].exercises.map(ex => ex.id), ['one']);
  assert.deepEqual(getBooks({ books: [], chapters: [], exercises: [] }), []);
});
