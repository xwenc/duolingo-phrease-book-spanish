import type { EvaluationResult, Exercise } from '../types';
export interface Stats { canResetData?: boolean; hearts: number; xp: number; gems: number; streak: number; starredIds: string[] }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init,
    headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = typeof error.detail === 'string' ? error.detail : Array.isArray(error.detail)
      ? error.detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.slice(1).join('.') || '表单'}: ${item.msg || '输入无效'}`).join('；')
      : `请求失败 (${response.status})`;
    throw new Error(detail);
  }
  return response.json();
}
export const submitAttempt = (exerciseId: string, transcript: string, requestId: string) =>
  api<{ evaluation: EvaluationResult; stats: Stats }>('/attempts', {
    method: 'POST', body: JSON.stringify({ exerciseId, transcript, requestId }),
  });


export interface CatalogBook {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  chapterCount: number;
  level?: string;
}
export interface CatalogChapter {
  id: string;
  bookId: string;
  name: string;
  description: string;
  icon: string;
  sentenceCount: number;
}
export interface LearningCatalog {
  books: CatalogBook[];
  chapters: CatalogChapter[];
  exercises: Exercise[];
}
export const fetchCatalog = () => api<LearningCatalog>('/catalog');
