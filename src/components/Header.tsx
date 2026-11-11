/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Flame, Heart, Gem, Star, Volume2, VolumeX, ChevronLeft, Layers } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

interface HeaderProps {
  currentIndex: number;
  totalQuestions: number;
  hearts: number;
  streak: number;
  gems: number;
  starredCount: number;
  isStarredMode: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenDifficultiesModal: () => void;
  onOpenUnitSelector: () => void;
  onExitPractice?: () => void;
  heartLostPulse: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentIndex,
  totalQuestions,
  hearts,
  streak,
  gems,
  starredCount,
  isStarredMode,
  isMuted,
  onToggleMute,
  onOpenDifficultiesModal,
  onOpenUnitSelector,
  onExitPractice,
  heartLostPulse,
}) => {
  const progressRatio = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;

  return (
    <header className="w-full max-w-4xl mx-auto px-4 pt-3 pb-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Exit or Units button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onExitPractice && (
            <button
              onClick={() => {
                soundEffects.playClickSound();
                onExitPractice();
              }}
              title="返回教材馆"
              className="flex items-center p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" /><span className="text-xs font-bold">换书</span>
            </button>
          )}

          <button
            onClick={() => {
              soundEffects.playClickSound();
              onOpenUnitSelector();
            }}
            title="选择训练主题单元"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#1cb0f6]" />
            <span className="hidden sm:inline">切换单元</span>
          </button>
        </div>

        {/* Center: Duolingo Green Progress Bar */}
        <div className="flex-1 max-w-md mx-2">
          <div className="w-full bg-[#e5e5e5] h-3.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-[#58cc02] h-full rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${Math.max(progressRatio, 4)}%` }}
            >
              {/* Highlight gleam */}
              <div className="absolute top-0.5 left-2 right-2 h-1 bg-white/40 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Stats: Streak, Gems, Hearts, Starred Review */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Streak Flame */}
          <div
            className="flex items-center gap-1 text-[#ff9600] font-extrabold text-sm"
            title={`连续打卡 ${streak} 天`}
          >
            <Flame className="w-5 h-5 fill-current animate-pulse" />
            <span className="tabular-nums">{streak}</span>
          </div>

          {/* Gems */}
          <div
            className="hidden sm:flex items-center gap-1 text-[#1cb0f6] font-extrabold text-sm"
            title={`宝石数量: ${gems}`}
          >
            <Gem className="w-4 h-4 fill-current" />
            <span className="tabular-nums">{gems}</span>
          </div>

          {/* Hearts ❤️ */}
          <div
            className={`flex items-center gap-1 font-extrabold text-sm transition-transform ${
              heartLostPulse ? 'animate-heart-pulse text-red-600 scale-125' : 'text-[#ff4b4b]'
            }`}
            title={`剩余红心: ${hearts} / 5`}
          >
            <Heart className="w-5 h-5 fill-current" />
            <span className="tabular-nums">{hearts}</span>
          </div>

          {/* Starred Difficulties Button */}
          <button
            onClick={() => {
              soundEffects.playClickSound();
              onOpenDifficultiesModal();
            }}
            className={`relative flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl border transition-all ${
              isStarredMode
                ? 'bg-[#ffc800] border-[#e5a400] text-slate-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="查看或专项练习星标生词难点"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isStarredMode ? 'fill-slate-900 text-slate-900' : 'fill-amber-400 text-amber-500'
              }`}
            />
            <span className="hidden sm:inline">难点复习</span>
            {starredCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white rounded-full font-black tabular-nums">
                {starredCount}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleMute();
            }}
            title={isMuted ? '开启音效' : '静音'}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
