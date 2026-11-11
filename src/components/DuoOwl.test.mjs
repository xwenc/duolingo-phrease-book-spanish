import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DuoOwl } from './DuoOwl.tsx';
import { QuestionCard } from './QuestionCard.tsx';

const render = mood => renderToStaticMarkup(React.createElement(DuoOwl, { mood }));

test('correct answers have an accessible happy expression without tears', () => {
  const html = render('cheer');
  assert.match(html, /aria-label="猫头鹰开心庆祝"/);
  assert.match(html, /owl-happy/);
  assert.doesNotMatch(html, /owl-tear/);
});

test('incorrect answers have a sad expression with a tear', () => {
  const html = render('sad');
  assert.match(html, /aria-label="猫头鹰难过流泪"/);
  assert.match(html, /owl-sad/);
  assert.match(html, /owl-tear/);
  assert.doesNotMatch(html, /owl-happy/);
});

test('unanswered questions return to a neutral expression', () => {
  const html = render('thinking');
  assert.match(html, /aria-label="猫头鹰等待作答"/);
  assert.doesNotMatch(html, /owl-happy|owl-sad|owl-tear/);
});

test('question card shows the expression selected by answer status', () => {
  const exercise = { id: 'one', spanish: 'Hola', chinese: '你好', unitName: '问候', difficulty: 'easy', phonetics: 'o-la', vocabHints: [] };
  for (const mood of ['cheer', 'sad', 'thinking']) {
    const html = renderToStaticMarkup(React.createElement(QuestionCard, { exercise, owlMood: mood, isStarred: false, onToggleStar: () => {} }));
    assert.ok(html.includes(`data-mood="${mood}"`));
  }
});
