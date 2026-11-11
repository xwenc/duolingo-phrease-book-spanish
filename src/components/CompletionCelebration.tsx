/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Sparkles, Flame, Gem, Trophy, RotateCcw, Star, Layers } from 'lucide-react';
import { getAverageAccuracy } from '../utils/sessionAccuracy';
import { DuoOwl } from './DuoOwl';
import { soundEffects } from '../services/soundEffects';

interface CompletionCelebrationProps {
  scores: number[];
  xpEarned: number;
  gemsEarned: number;
  streak: number;
  starredCount: number;
  onRestart: () => void;
  onPracticeStarred: () => void;
  onOpenUnitSelector: () => void;
}

export const CompletionCelebration: React.FC<CompletionCelebrationProps> = ({
  scores,
  xpEarned,
  gemsEarned,
  streak,
  starredCount,
  onRestart,
  onPracticeStarred,
  onOpenUnitSelector,
}) => {
  useEffect(() => {
    soundEffects.playCompleteSound();
  }, []);

  const accuracy = getAverageAccuracy(scores);

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
      {/* Duo Owl Celebrating */}
      <div className="mb-3 animate-duo-bounce">
        <DuoOwl mood="celebrate" size={140} />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black mb-2">
        <Trophy className="w-4 h-4 text-amber-600 fill-current" />
        <span>口语练习圆满达成！</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">
        太棒了！势如破竹！
      </h1>
      <p className="text-sm font-bold text-slate-500 mt-1 max-w-sm">
        你已经完成了本轮西班牙语强化朗读，发音地道感显著提升！
      </p>

      {/* Rewards Grid */}
      <div className="grid grid-cols-3 gap-3 w-full my-6">
        {/* XP Card */}
        <div className="bg-white border-2 border-amber-200 rounded-2xl p-3 flex flex-col items-center shadow-xs">
          <Sparkles className="w-6 h-6 text-[#ffc800] fill-current mb-1" />
          <span className="text-[11px] font-bold text-slate-400">经验值</span>
          <span className="text-xl font-black text-amber-500 tabular-nums">+{xpEarned} XP</span>
        </div>

        {/* Accuracy Card */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-3 flex flex-col items-center shadow-xs">
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#58cc02] flex items-center justify-center font-black text-xs mb-1">
            %
          </div>
          <span className="text-[11px] font-bold text-slate-400">平均准确率</span>
          <span className="text-xl font-black text-[#58cc02] tabular-nums">{accuracy}%</span>
        </div>

        {/* Streak Flame Card */}
        <div className="bg-white border-2 border-orange-200 rounded-2xl p-3 flex flex-col items-center shadow-xs">
          <Flame className="w-6 h-6 text-[#ff9600] fill-current mb-1 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-400">连胜打卡</span>
          <span className="text-xl font-black text-[#ff9600] tabular-nums">{streak} 天</span>
        </div>
      </div>

      {/* Gems Earned Notification */}
      <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-200 rounded-2xl text-xs font-bold text-sky-700 mb-6">
        <Gem className="w-4 h-4 text-[#1cb0f6] fill-current" />
        <span>奖励已发放：+{gemsEarned} 宝石已存入你的账户</span>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-3">
        {/* Option 1: Restart current pool */}
        <button
          onClick={() => {
            soundEffects.playClickSound();
            onRestart();
          }}
          className="duo-btn-green w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 stroke-[3]" />
          <span>再来一组口语训练</span>
        </button>

        {/* Option 2: Starred Review if any */}
        {starredCount > 0 && (
          <button
            onClick={() => {
              soundEffects.playClickSound();
              onPracticeStarred();
            }}
            className="duo-btn-yellow w-full py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Star className="w-4 h-4 fill-current" />
            <span>专项强化星标难点 ({starredCount} 题)</span>
          </button>
        )}

        {/* Option 3: Choose Unit */}
        <button
          onClick={() => {
            soundEffects.playClickSound();
            onOpenUnitSelector();
          }}
          className="duo-btn-gray w-full py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2"
        >
          <Layers className="w-4 h-4 text-[#1cb0f6]" />
          <span>切换其他西语单元</span>
        </button>
      </div>
    </div>
  );
};
