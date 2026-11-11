import type { Exercise, EvaluationResult } from '../types';
import type { CatalogChapter, LearningCatalog } from '../services/api';

export interface Book {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  level?: string;
  chapters: CatalogChapter[];
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
  sessionScores: Record<string, number>;
  sessionXpGained: number;
  sessionGemsGained: number;
  starredIds: string[];
}
export type BooksProgressMap = Record<string, BookProgress>;

/** Adapt the server catalog for display; never infer book identity from exercise IDs. */
export function getBooks(catalog: LearningCatalog): Book[] {
  const colors = ['#1cb0f6', '#ce82ff', '#ff9600', '#58cc02'];
  return catalog.books.map((book, index) => ({
    id: book.id,
    title: book.name,
    description: book.description,
    thumbnail: book.thumbnail,
    level: book.level,
    color: colors[index % colors.length],
    chapters: catalog.chapters.filter(chapter => chapter.bookId === book.id),
    exercises: catalog.exercises.filter(exercise => exercise.bookId === book.id),
  }));
}
