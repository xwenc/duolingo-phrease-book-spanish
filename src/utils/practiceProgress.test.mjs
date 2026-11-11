import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getPracticeProgress } from './practiceProgress.ts';
import { Header } from '../components/Header.tsx';
import { BooksLibrary } from '../components/BooksLibrary.tsx';

const headerProps = { hearts: 5, streak: 0, gems: 0, starredCount: 0, isStarredMode: false, isMuted: true, onToggleMute() {}, onOpenDifficultiesModal() {}, onOpenUnitSelector() {}, heartLostPulse: false };

test('progress counts checked sentences exactly once and reaches 100%', () => {
  assert.deepEqual(getPracticeProgress(0, 3), { completed: 0, total: 3, percent: 0 });
  assert.ok(Math.abs(getPracticeProgress(0, 3, 'correct').percent - 100 / 3) < 1e-10);
  assert.deepEqual(getPracticeProgress(0, 3, 'incorrect'), getPracticeProgress(1, 3, 'unanswered'));
  assert.equal(getPracticeProgress(2, 3, 'unanswered').completed, 2);
  assert.equal(getPracticeProgress(2, 3, 'correct').percent, 100);
  assert.equal(getPracticeProgress(2, 3, 'incorrect').percent, 100);
  assert.equal(getPracticeProgress(2, 3, 'unanswered', true).percent, 100);
  assert.equal(getPracticeProgress(0, 1, 'correct').percent, 100);
  assert.equal(getPracticeProgress(10, 3).percent, 100);
  assert.equal(getPracticeProgress(0, 0, 'correct', true).percent, 0);
});

test('header starts empty and displays matching sentence count and fill width', () => {
  const render = props => renderToStaticMarkup(React.createElement(Header, { ...headerProps, isCompleted: false, ...props }));
  const initial = render({ currentIndex: 0, totalQuestions: 20, status: 'unanswered' });
  assert.match(initial, /width:0%/);
  assert.match(initial, /aria-valuetext="已完成 0\/20 句"/);
  const checked = render({ currentIndex: 12, totalQuestions: 20, status: 'correct' });
  assert.match(checked, /width:65%/);
  assert.match(checked, /aria-valuetext="已完成 13\/20 句"/);
  const completed = render({ currentIndex: 19, totalQuestions: 20, status: 'incorrect', isCompleted: true });
  assert.match(completed, /width:100%/);
});

test('library and header use the same progress when returning after a checked answer', () => {
  const book = { id: 'book', title: '教材', color: '#58cc02', chapters: [], exercises: [{ id: 'a', unitId: 'one' }, { id: 'b', unitId: 'one' }, { id: 'c', unitId: 'two' }] };
  const progress = { book: { currentIndex: 0, selectedUnitId: 'one', status: 'correct', isCompleted: false, isStarredMode: false } };
  const html = renderToStaticMarkup(React.createElement(BooksLibrary, { books: [book], progress, currentBookId: 'book', starredIds: [], onSelectBook() {} }));
  assert.match(html, /width:50%/);
  assert.match(html, /1\/2 句 · 50%/);
});
