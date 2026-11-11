import type { Exercise, EvaluationResult } from '../types';

export interface Book {
  id: string;
  title: string;
  level: string;
  color: string;
  exercises: Exercise[];
}
export interface BookProgress {
  selectedUnitId: string;
  isStarredMode: boolean;
  currentIndex: number;
  currentTranscript: string;
  status: 'unanswered' | 'correct' | 'incorrect';
  evaluationResult: EvaluationResult | null;
  attemptId: string;
  isCompleted: boolean;
  sessionCorrectCount: number;
  sessionXpGained: number;
  sessionGemsGained: number;
  starredIds: string[];
}
export type BooksProgressMap = Record<string, BookProgress>;

export function getBooks(exercises: Exercise[]): Book[] {
  const books = new Map<string, Book>();
  const colors = ['#1cb0f6', '#ce82ff', '#ff9600', '#58cc02'];
  for (const exercise of exercises) {
    const imported = exercise.id.startsWith('book-');
    const id = exercise.bookId || (imported ? 'textbook' : 'everyday');
    if (!books.has(id)) books.set(id, {
      id,
      title: exercise.bookTitle || (imported ? '西班牙语教材 · 基础用语' : '西班牙语 · 日常口语'),
      level: exercise.bookLevel || (imported ? 'A1' : 'A1–A2'),
      color: colors[books.size % colors.length],
      exercises: [],
    });
    books.get(id)!.exercises.push(exercise);
  }
  return [...books.values()];
}
