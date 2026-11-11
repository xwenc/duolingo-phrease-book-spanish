import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAverageAccuracy } from './sessionAccuracy.ts';
import { CompletionCelebration } from '../components/CompletionCelebration.tsx';


test('accuracy averages sentence scores instead of the number of passing answers', () => {
  assert.equal(getAverageAccuracy([75]), 75);
  assert.equal(getAverageAccuracy([100, 80, 0]), 60);
  assert.equal(getAverageAccuracy([100, 100, 0]), 67);
  assert.equal(getAverageAccuracy([50, 60]), 55);
});

test('a fresh round has zero accuracy and the average remains within 0–100', () => {
  assert.equal(getAverageAccuracy([]), 0);
  assert.equal(getAverageAccuracy(Array(11).fill(100)), 100);
  assert.equal(getAverageAccuracy([367, -20, NaN, Infinity]), 25);
});

test('completion screen displays the mean score for this round', () => {
  const props = { scores: [100, 80, 0], xpEarned: 15, gemsEarned: 2, streak: 1, starredCount: 0, onRestart() {}, onPracticeStarred() {}, onOpenUnitSelector() {} };
  const html = renderToStaticMarkup(React.createElement(CompletionCelebration, props));
  assert.match(html, /平均准确率/);
  assert.match(html, />60%<\/span>/);
  assert.doesNotMatch(html, />367%/);
  const newRound = renderToStaticMarkup(React.createElement(CompletionCelebration, { ...props, scores: [] }));
  assert.match(newRound, />0%<\/span>/);
});
