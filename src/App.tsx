/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, submitAttempt, fetchCatalog, type LearningCatalog, type Stats } from './services/api';
import { AuthGate } from './components/AuthGate';
import { ResetPracticeModal } from './components/ResetPracticeModal';
import { Exercise, EvaluationResult } from './types';
import { soundEffects } from './services/soundEffects';
import { TTSService, sttService } from './services/speechService';
import { Header } from './components/Header';
import { QuestionCard } from './components/QuestionCard';
import { SpeechRecorder } from './components/SpeechRecorder';
import { WordDiffView } from './components/WordDiffView';
import { BottomActionBar } from './components/BottomActionBar';
import { DifficultiesModal } from './components/DifficultiesModal';
import { HeartRestockModal } from './components/HeartRestockModal';
import { UnitSelectorModal } from './components/UnitSelectorModal';
import { CompletionCelebration } from './components/CompletionCelebration';
import { OwlMood } from './components/DuoOwl';

import { getBooks, type BooksProgressMap, type BookProgress } from './data/books';
import { BooksLibrary } from './components/BooksLibrary';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [catalog, setCatalog] = useState<LearningCatalog>({ books: [], chapters: [], exercises: [] });
  const exercises = catalog.exercises;
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [canResetData, setCanResetData] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [hearts, setHearts] = useState(5);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [gems, setGems] = useState(0);
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [attemptId, setAttemptId] = useState<string>(() => crypto.randomUUID());
  const applyStats = (stats: Stats) => {
    setCanResetData(Boolean(stats.canResetData));
    setHearts(stats.hearts); setStreak(stats.streak); setXp(stats.xp);
    setGems(stats.gems); setStarredIds(stats.starredIds);
  };
  const load = async () => {
    setLoading(true); setError('');
    try {
      const stats = await api<Stats>('/me');
      setAuthenticated(true); applyStats(stats);
      setCatalog(await fetchCatalog());
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEffects.getIsMuted());

  // 2. 练习状态与模式
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all');
  const [isStarredMode, setIsStarredMode] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [status, setStatus] = useState<'unanswered' | 'correct' | 'incorrect'>('unanswered');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [heartLostPulse, setHeartLostPulse] = useState<boolean>(false);

  // 本轮训练统计
  const [sessionScores, setSessionScores] = useState<Record<string, number>>({});
  const attemptPending = useRef(false);
  const [sessionXpGained, setSessionXpGained] = useState<number>(0);
  const [sessionGemsGained, setSessionGemsGained] = useState<number>(0);

  const resetSessionStats = () => {
    setSessionScores({});
    setSessionXpGained(0);
    setSessionGemsGained(0);
  };

  // 弹窗状态
  const [isDifficultiesModalOpen, setIsDifficultiesModalOpen] = useState<boolean>(false);
  const [isHeartRestockOpen, setIsHeartRestockOpen] = useState<boolean>(false);
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState<boolean>(false);

  const [currentView, setCurrentView] = useState<'books' | 'practice' | 'admin'>('books');
  const [currentBookId, setCurrentBookId] = useState('');
  const [booksProgress, setBooksProgress] = useState<BooksProgressMap>({});
  const books = useMemo(() => getBooks(catalog), [catalog]);
  const currentBook = books.find(book => book.id === currentBookId);
  const bookExercises = currentBook?.exercises || [];
  const snapshot = (): BookProgress => ({
    selectedUnitId, isStarredMode, currentIndex,
    currentTranscript, status, evaluationResult, attemptId, isCompleted,
    sessionScores, sessionXpGained, sessionGemsGained,
    starredIds: bookExercises.filter(ex => starredIds.includes(ex.id)).map(ex => ex.id)
  });
  const openBooks = () => {
    if (busy) return;
    TTSService.stop(); sttService.cancel();
    setBooksProgress(previous => ({ ...previous, [currentBookId]: snapshot() }));
    setIsDifficultiesModalOpen(false); setIsUnitSelectorOpen(false); setIsHeartRestockOpen(false);
    setCurrentView('books');
  };
  const selectBook = (id: string) => {
    if (!books.find(book => book.id === id)?.exercises.length) return;
    TTSService.stop(); sttService.cancel();
    const saved = booksProgress[id];
    setCurrentBookId(id);
    if (saved) {
      setSelectedUnitId(saved.selectedUnitId); setIsStarredMode(saved.isStarredMode);
      setCurrentIndex(saved.currentIndex); setCurrentTranscript(saved.currentTranscript);
      setStatus(saved.status); setEvaluationResult(saved.evaluationResult); setAttemptId(saved.attemptId);
      setIsCompleted(saved.isCompleted); setSessionScores(saved.sessionScores);
      setSessionXpGained(saved.sessionXpGained); setSessionGemsGained(saved.sessionGemsGained);
      if (saved.isCompleted) handleRestart();
    } else { setSelectedUnitId('all'); setIsStarredMode(false); handleRestart(); }
    setCurrentView('practice');
  };

  // 3. 计算当前激活的题目池
  const activeExercises: Exercise[] = useMemo(() => {
    if (isStarredMode) {
      const filtered = bookExercises.filter((ex) => starredIds.includes(ex.id));
      return filtered.length > 0 ? filtered : bookExercises.slice(0, 5);
    }
    if (selectedUnitId !== 'all') {
      const filtered = bookExercises.filter((ex) => ex.unitId === selectedUnitId);
      return filtered.length > 0 ? filtered : bookExercises;
    }
    return bookExercises;
  }, [isStarredMode, selectedUnitId, starredIds, bookExercises]);

  const currentExercise = activeExercises[currentIndex] || activeExercises[0] || exercises[0];

  useEffect(() => {
    const showTTSError = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('tts-error', showTTSError);
    return () => { window.removeEventListener('tts-error', showTTSError); TTSService.stop(); };
  }, []);

  // 星标列表
  const starredExercises = useMemo(() => {
    return bookExercises.filter((ex) => starredIds.includes(ex.id));
  }, [starredIds, bookExercises]);

  const updateStar = async (id: string, enabled: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try { applyStats(await api<Stats>(`/stars/${id}?enabled=${enabled}`, { method: 'PUT' })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const handleToggleStar = (id: string) => { void updateStar(id, !starredIds.includes(id)); };
  const handleRemoveStar = (id: string) => { void updateStar(id, false); };

  // 开启难点专项强化练习
  const handleStartStarredPractice = () => {
    resetSessionStats();
    setIsDifficultiesModalOpen(false);
    setIsStarredMode(true);
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setAttemptId(crypto.randomUUID());
    setIsCompleted(false);
  };

  // 切换单元
  const handleSelectUnit = (unitId: string | 'all') => {
    resetSessionStats();
    setSelectedUnitId(unitId);
    setIsStarredMode(false);
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setAttemptId(crypto.randomUUID());
    setIsCompleted(false);
  };

  const check = async (transcript: string) => {
    if (attemptPending.current || busy || status !== 'unanswered') return;
    if (hearts <= 0) { setIsHeartRestockOpen(true); return; }
    attemptPending.current = true;
    setBusy(true); setError('');
    try {
      const { evaluation, stats } = await submitAttempt(currentExercise.id, transcript, attemptId);
      setSessionScores(previous => ({ ...previous, [currentExercise.id]: evaluation.score }));
      setSessionXpGained(x => x + Math.max(0, stats.xp - xp));
      setSessionGemsGained(g => g + Math.max(0, stats.gems - gems));
      applyStats(stats); setEvaluationResult(evaluation);
      setStatus(evaluation.isPassed ? 'correct' : 'incorrect');
      if (evaluation.isPassed) { soundEffects.playCorrectSound(); }
      else { soundEffects.playIncorrectSound(); setHeartLostPulse(true); setTimeout(() => setHeartLostPulse(false), 500); }
      if (!stats.hearts) setIsHeartRestockOpen(true);
    } catch (err) { setError((err as Error).message); }
    finally { attemptPending.current = false; setBusy(false); }
  };
  const handleCheck = () => { if (currentTranscript.trim()) void check(currentTranscript); };
  const handleSkip = () => { void check(''); };

  // 进入下一题
  const handleNext = () => {
    TTSService.stop();
    if (currentIndex + 1 < activeExercises.length) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentTranscript('');
      setStatus('unanswered');
      setEvaluationResult(null);
      setAttemptId(crypto.randomUUID());
    } else {
      // 达成通关
      setIsCompleted(true);

    }
  };

  // 重新开始
  const handleRestart = () => {
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setAttemptId(crypto.randomUUID());
    setIsCompleted(false);
    resetSessionStats();
  };

  const handleRefillFull = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { applyStats(await api<Stats>('/hearts/refill', { method: 'POST' })); setIsHeartRestockOpen(false); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const handleResetData = async (password: string) => {
    setBusy(true); setError('');
    TTSService.stop(); sttService.cancel();
    try {
      const result = await api<{ stats: Stats; exercises: Exercise[] }>('/admin/reset-practice', {
        method: 'POST', body: JSON.stringify({ password, confirmed: true }),
      });
      applyStats(result.stats); setCatalog(await fetchCatalog());
      setBooksProgress({}); setCurrentBookId(''); setCurrentView('books');
      setSelectedUnitId('all'); setIsStarredMode(false); handleRestart();
      setIsDifficultiesModalOpen(false); setIsHeartRestockOpen(false); setIsUnitSelectorOpen(false);
      setResetOpen(false); setNotice('练习数据已清空，已载入最新题库，可以重新开始。');
    } finally { setBusy(false); }
  };

  // 确定多邻国猫头鹰表情
  const owlMood: OwlMood = useMemo(() => {
    if (isCompleted) return 'celebrate';
    if (status === 'correct') return 'cheer';
    if (status === 'incorrect') return 'sad';
    return 'thinking';
  }, [status, isCompleted]);

  // 静音切换
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEffects.setMuted(nextMuted);
  };

  if (loading) return <p className="p-8">正在加载…</p>;
  if (!authenticated) return <AuthGate onAuthenticated={() => { void load(); }} />;


  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#4b4b4b] flex flex-col font-['Nunito',sans-serif]">
      <div className="px-4 pt-2 flex justify-between text-sm"><span>经验值 {xp}</span><div className='flex items-center justify-end'>{canResetData && <div className="px-4 flex justify-end gap-4"><button disabled={busy || currentView === 'admin'} className="text-sm font-bold text-sky-600 hover:underline disabled:opacity-50" onClick={() => { if (currentView === 'practice') openBooks(); TTSService.stop(); sttService.cancel(); setCurrentView('admin'); }}>管理后台</button><button disabled={busy} className="text-xs text-red-600 underline" onClick={() => { TTSService.stop(); sttService.cancel(); setResetOpen(true); }}>重置练习数据</button></div>}<button disabled={busy} onClick={async () => { try { await api('/logout', { method: 'POST' }); setAuthenticated(false); setBooksProgress({}); setCurrentBookId(''); setCurrentView('books'); handleRestart(); } catch (err) { setError((err as Error).message); } }}>退出登录</button></div></div>
      {resetOpen && <ResetPracticeModal busy={busy} onClose={() => setResetOpen(false)} onReset={handleResetData} />}
      {notice && <p role="status" className="px-4 text-green-700">{notice}</p>}
      {error && <p role="alert" className="p-3 text-red-600">{error}</p>}
      {busy && <div role="status" className="fixed inset-0 z-[100] bg-white/60 flex items-center justify-center" aria-live="polite">正在保存…</div>}
      {currentView === 'admin' && canResetData ? <AdminDashboard onExit={async changed => {
        const [nextCatalog, stats] = await Promise.all([fetchCatalog(), api<Stats>('/me')]);
        setCatalog(nextCatalog); applyStats(stats);
        if (changed) { setBooksProgress({}); setCurrentBookId(''); setSelectedUnitId('all'); setIsStarredMode(false); handleRestart(); }
        setCurrentView('books');
      }} /> : currentView === 'books' ? <BooksLibrary books={books} progress={booksProgress} currentBookId={currentBookId} starredIds={starredIds} onSelectBook={selectBook} /> : <>
        {/* Duolingo Sticky Top Header */}
        <Header
          currentIndex={currentIndex}
          totalQuestions={activeExercises.length}
          status={status}
          isCompleted={isCompleted}
          hearts={hearts}
          streak={streak}
          gems={gems}
          starredCount={starredExercises.length}
          isStarredMode={isStarredMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenDifficultiesModal={() => setIsDifficultiesModalOpen(true)}
          onOpenUnitSelector={() => setIsUnitSelectorOpen(true)}
          onExitPractice={openBooks}
          heartLostPulse={heartLostPulse}
        />

        {/* Main Practice Stage */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-3 pb-32 flex flex-col items-center justify-start">
          {isCompleted ? (
            /* Completion Screen */
            <CompletionCelebration
              scores={Object.values(sessionScores)}
              xpEarned={sessionXpGained}
              gemsEarned={sessionGemsGained}
              streak={streak}
              starredCount={starredExercises.length}
              onRestart={handleRestart}
              onPracticeStarred={handleStartStarredPractice}
              onOpenUnitSelector={() => setIsUnitSelectorOpen(true)}
            />
          ) : (
            /* Active Question Flow */
            <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
              {/* Mode Banner if in Starred Review */}
              {isStarredMode && (
                <div className="w-full py-2 px-3 bg-amber-100 border border-amber-300 rounded-2xl flex items-center justify-between text-xs font-black text-amber-900 shadow-xs">
                  <span>⭐ 当前为难点专项强化复习模式 ({currentIndex + 1}/{activeExercises.length})</span>
                  <button
                    onClick={() => handleSelectUnit('all')}
                    className="text-amber-800 underline hover:text-amber-950 font-bold"
                  >
                    退出专项
                  </button>
                </div>
              )}

              {/* Question Card */}
              <QuestionCard
                exercise={currentExercise}
                isStarred={starredIds.includes(currentExercise.id)}
                onToggleStar={handleToggleStar}
                owlMood={owlMood}
              />

              {/* Word-by-Word Diff View if checked */}
              {evaluationResult && status !== 'unanswered' ? (
                <WordDiffView
                  diffTokens={evaluationResult.diffTokens}
                  rawSpoken={evaluationResult.rawSpoken}
                  isPassed={evaluationResult.isPassed}
                  score={evaluationResult.score}
                />
              ) : (
                /* Speech Recording / Input Section */
                <SpeechRecorder
                  key={`${currentExercise.id}:${resetOpen}`}
                  shortcutsEnabled={!resetOpen && !isDifficultiesModalOpen && !isHeartRestockOpen && !isUnitSelectorOpen}
                  currentTranscript={currentTranscript}
                  onTranscriptChange={text => { setCurrentTranscript(text); setAttemptId(crypto.randomUUID()); }}
                  isEvaluating={status !== 'unanswered'}
                  disabled={busy || status !== 'unanswered'}
                />
              )}
            </div>
          )}
        </main>

        {/* Duolingo 3D Tactile Bottom Action Bar */}
        {!isCompleted && (
          <BottomActionBar
            status={status}
            hasInput={!busy && currentTranscript.trim().length > 0}
            onCheck={handleCheck}
            onSkip={handleSkip}
            onNext={handleNext}
            evaluationResult={evaluationResult}
            currentExercise={currentExercise}
          />
        )}

        {/* Modals */}
        <DifficultiesModal
          isOpen={isDifficultiesModalOpen}
          onClose={() => setIsDifficultiesModalOpen(false)}
          starredExercises={starredExercises}
          onRemoveStar={handleRemoveStar}
          onStartStarredPractice={handleStartStarredPractice}
        />

        <HeartRestockModal
          isOpen={isHeartRestockOpen}
          onClose={() => setIsHeartRestockOpen(false)}
          onRefillFull={handleRefillFull}
        />

        <UnitSelectorModal
          isOpen={isUnitSelectorOpen}
          onClose={() => setIsUnitSelectorOpen(false)}
          chapters={currentBook?.chapters || []}
          selectedUnitId={selectedUnitId}
          onSelectUnit={handleSelectUnit}
        />
      </>}
    </div>
  );
}
