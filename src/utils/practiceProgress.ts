/** Completed sentences in the current practice sequence, including a checked answer. */
export function getPracticeProgress(
  currentIndex: number,
  totalQuestions: number,
  status: 'unanswered' | 'correct' | 'incorrect' = 'unanswered',
  isCompleted = false,
) {
  const total = Math.max(0, totalQuestions);
  const completed = Math.min(total, Math.max(0, isCompleted ? total : currentIndex + (status === 'unanswered' ? 0 : 1)));
  return { completed, total, percent: total > 0 ? completed / total * 100 : 0 };
}
