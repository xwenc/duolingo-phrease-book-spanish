import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionCard } from './QuestionCard.tsx';

const exercise = { id: 'sentence', name: '问候', unitId: 'chapter', unitName: '入门', spanish: 'Hola', chinese: '你好', phonetics: 'o-la', difficulty: 'easy', vocabHints: [] };
const render = value => renderToStaticMarkup(React.createElement(QuestionCard, { exercise: value, isStarred: false, onToggleStar: () => {}, owlMood: 'thinking' }));

test('practice card displays the optional sentence image', () => {
  const html = render({ ...exercise, imageUrl: '/api/covers/sentence.webp' });
  assert.match(html, /src="\/api\/covers\/sentence.webp"/);
  assert.match(html, /alt="问候配图"/);
});

test('practice card without an image has no empty image area', () => {
  assert.doesNotMatch(render(exercise), /<figure|<img/);
  assert.doesNotMatch(render({ ...exercise, imageUrl: '' }), /<figure|<img/);
});
