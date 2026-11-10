import type { EvaluationResult } from '../types';
export interface Stats { canResetData?: boolean; hearts: number; xp: number; gems: number; streak: number; starredIds: string[] }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init,
    headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : `请求失败 (${response.status})`);
  }
  return response.json();
}
export const submitAttempt = (exerciseId: string, transcript: string, requestId: string) =>
  api<{ evaluation: EvaluationResult; stats: Stats }>('/attempts', {
    method: 'POST', body: JSON.stringify({ exerciseId, transcript, requestId }),
  });
