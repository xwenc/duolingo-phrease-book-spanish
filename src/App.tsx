/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SPANISH_EXERCISES } from './data/spanishExercises';
import { Exercise, EvaluationResult } from './types';
import { evaluateSpokenSpanish } from './utils/diffAlgorithm';
import { soundEffects } from './services/soundEffects';
import { TTSService } from './services/speechService';
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

export default function App() {
  // 1. 用户持久化数据（红心、连胜、宝石、经验值、星标生词难点）
  const [hearts, setHearts] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('duo_spanish_hearts');
      return saved !== null ? Math.min(5, Math.max(0, parseInt(saved, 10))) : 5;
    } catch {
      return 5;
    }
  });

  const [streak, setStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('duo_spanish_streak');
      return saved !== null ? parseInt(saved, 10) : 3;
    } catch {
      return 3;
    }
  });

  const [xp, setXp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('duo_spanish_xp');
      return saved !== null ? parseInt(saved, 10) : 120;
    } catch {
      return 120;
    }
  });

  const [gems, setGems] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('duo_spanish_gems');
      return saved !== null ? parseInt(saved, 10) : 48;
    } catch {
      return 48;
    }
  });

  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('duo_spanish_starred_ids');
      return saved ? JSON.parse(saved) : ['u1-4', 'u3-1']; // 预置2道典型易错难点
    } catch {
      return ['u1-4', 'u3-1'];
    }
  });

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
  const [sessionCorrectCount, setSessionCorrectCount] = useState<number>(0);
  const [sessionXpGained, setSessionXpGained] = useState<number>(0);
  const [sessionGemsGained, setSessionGemsGained] = useState<number>(0);

  // 弹窗状态
  const [isDifficultiesModalOpen, setIsDifficultiesModalOpen] = useState<boolean>(false);
  const [isHeartRestockOpen, setIsHeartRestockOpen] = useState<boolean>(false);
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState<boolean>(false);

  // 3. 计算当前激活的题目池
  const activeExercises: Exercise[] = useMemo(() => {
    if (isStarredMode) {
      const filtered = SPANISH_EXERCISES.filter((ex) => starredIds.includes(ex.id));
      return filtered.length > 0 ? filtered : SPANISH_EXERCISES.slice(0, 5);
    }
    if (selectedUnitId !== 'all') {
      const filtered = SPANISH_EXERCISES.filter((ex) => ex.unitId === selectedUnitId);
      return filtered.length > 0 ? filtered : SPANISH_EXERCISES;
    }
    return SPANISH_EXERCISES;
  }, [isStarredMode, selectedUnitId, starredIds]);

  const currentExercise = activeExercises[currentIndex] || activeExercises[0] || SPANISH_EXERCISES[0];

  // 持久化存储
  useEffect(() => {
    try {
      localStorage.setItem('duo_spanish_hearts', hearts.toString());
      localStorage.setItem('duo_spanish_streak', streak.toString());
      localStorage.setItem('duo_spanish_xp', xp.toString());
      localStorage.setItem('duo_spanish_gems', gems.toString());
      localStorage.setItem('duo_spanish_starred_ids', JSON.stringify(starredIds));
    } catch {
      // ignore
    }
  }, [hearts, streak, xp, gems, starredIds]);

  // 星标列表
  const starredExercises = useMemo(() => {
    return SPANISH_EXERCISES.filter((ex) => starredIds.includes(ex.id));
  }, [starredIds]);

  // 切换星标
  const handleToggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // 移除星标
  const handleRemoveStar = useCallback((id: string) => {
    setStarredIds((prev) => prev.filter((item) => item !== id));
  }, []);

  // 开启难点专项强化练习
  const handleStartStarredPractice = () => {
    setIsDifficultiesModalOpen(false);
    setIsStarredMode(true);
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setIsCompleted(false);
  };

  // 切换单元
  const handleSelectUnit = (unitId: string | 'all') => {
    setSelectedUnitId(unitId);
    setIsStarredMode(false);
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setIsCompleted(false);
  };

  // 扣减红心
  const deductHeart = () => {
    setHeartLostPulse(true);
    soundEffects.playHeartLostSound();
    setTimeout(() => setHeartLostPulse(false), 500);

    setHearts((prev) => {
      const nextHearts = Math.max(0, prev - 1);
      if (nextHearts === 0) {
        setTimeout(() => setIsHeartRestockOpen(true), 600);
      }
      return nextHearts;
    });
  };

  // 核对答案
  const handleCheck = () => {
    if (!currentTranscript.trim()) return;

    const result = evaluateSpokenSpanish(currentExercise.spanish, currentTranscript);
    setEvaluationResult(result);

    if (result.isPassed) {
      setStatus('correct');
      soundEffects.playCorrectSound();
      setSessionCorrectCount((c) => c + 1);
      setSessionXpGained((x) => x + 15);
      setSessionGemsGained((g) => g + 2);
      setXp((x) => x + 15);
      setGems((g) => g + 2);
    } else {
      setStatus('incorrect');
      soundEffects.playIncorrectSound();
      deductHeart();
    }
  };

  // 跳过此题
  const handleSkip = () => {
    const result = evaluateSpokenSpanish(currentExercise.spanish, '');
    setEvaluationResult(result);
    setStatus('incorrect');
    deductHeart();
  };

  // 进入下一题
  const handleNext = () => {
    TTSService.stop();
    if (currentIndex + 1 < activeExercises.length) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentTranscript('');
      setStatus('unanswered');
      setEvaluationResult(null);
    } else {
      // 达成通关
      setIsCompleted(true);
      setStreak((s) => s + 1);
    }
  };

  // 重新开始
  const handleRestart = () => {
    setCurrentIndex(0);
    setCurrentTranscript('');
    setStatus('unanswered');
    setEvaluationResult(null);
    setIsCompleted(false);
    setSessionCorrectCount(0);
    setSessionXpGained(0);
    setSessionGemsGained(0);
  };

  // 补充红心
  const handleRefillFull = () => {
    setHearts(5);
    setIsHeartRestockOpen(false);
  };

  const handleRefillOne = () => {
    setHearts(1);
    setIsHeartRestockOpen(false);
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

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#4b4b4b] flex flex-col font-['Nunito',sans-serif]">
      {/* Duolingo Sticky Top Header */}
      <Header
        currentIndex={currentIndex}
        totalQuestions={activeExercises.length}
        hearts={hearts}
        streak={streak}
        gems={gems}
        starredCount={starredExercises.length}
        isStarredMode={isStarredMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenDifficultiesModal={() => setIsDifficultiesModalOpen(true)}
        onOpenUnitSelector={() => setIsUnitSelectorOpen(true)}
        onExitPractice={() => handleRestart()}
        heartLostPulse={heartLostPulse}
      />

      {/* Main Practice Stage */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-3 pb-32 flex flex-col items-center justify-start">
        {isCompleted ? (
          /* Completion Screen */
          <CompletionCelebration
            totalQuestions={activeExercises.length}
            correctCount={sessionCorrectCount}
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
                currentTranscript={currentTranscript}
                onTranscriptChange={setCurrentTranscript}
                isEvaluating={status !== 'unanswered'}
                disabled={status !== 'unanswered'}
              />
            )}
          </div>
        )}
      </main>

      {/* Duolingo 3D Tactile Bottom Action Bar */}
      {!isCompleted && (
        <BottomActionBar
          status={status}
          hasInput={currentTranscript.trim().length > 0}
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
        onRefillOne={handleRefillOne}
      />

      <UnitSelectorModal
        isOpen={isUnitSelectorOpen}
        onClose={() => setIsUnitSelectorOpen(false)}
        exercises={SPANISH_EXERCISES}
        selectedUnitId={selectedUnitId}
        onSelectUnit={handleSelectUnit}
      />
    </div>
  );
}
