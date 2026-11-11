/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VocabHint {
  es: string;
  zh: string;
}

export interface Exercise {
  bookId?: string;
  bookTitle?: string;
  bookLevel?: string;
  bookDescription?: string;
  bookThumbnail?: string;
  name?: string;
  imageUrl?: string;
  unitIcon?: string;
  id: string;
  unitId: string;
  unitName: string;
  spanish: string;
  chinese: string;
  phonetics: string; // 拼读/音标指导
  grammarTip?: string; // 语法小贴士
  vocabHints: VocabHint[]; // 词汇悬浮提示
  difficulty: 'easy' | 'medium' | 'hard';
}

export type TokenStatus = 'correct' | 'missing' | 'mispronounced' | 'punctuation';

export interface DiffToken {
  text: string;
  originalText: string;
  status: TokenStatus;
  userWord?: string;
  explanation?: string;
}

export interface EvaluationResult {
  score: number; // 0 - 100
  isPassed: boolean;
  diffTokens: DiffToken[];
  rawSpoken: string;
  normalizedSpoken: string;
  matchedCount: number;
  totalWords: number;
  encouragement: string;
}

export interface UserStats {
  hearts: number; // 0 - 5
  streak: number;
  xp: number;
  gems: number;
  starredIds: string[];
  completedIds: string[];
  lastPracticeDate?: string;
}

export type PracticeMode = 'all' | 'starred' | 'unit';
