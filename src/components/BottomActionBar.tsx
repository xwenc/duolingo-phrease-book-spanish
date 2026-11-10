/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Check, X, ArrowRight, SkipForward, Volume2 } from 'lucide-react';
import { EvaluationResult, Exercise } from '../types';
import { soundEffects } from '../services/soundEffects';
import { TTSService } from '../services/speechService';

interface BottomActionBarProps {
  status: 'unanswered' | 'correct' | 'incorrect';
  hasInput: boolean;
  onCheck: () => void;
  onSkip: () => void;
  onNext: () => void;
  evaluationResult: EvaluationResult | null;
  currentExercise: Exercise;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  status,
  hasInput,
  onCheck,
  onSkip,
  onNext,
  evaluationResult,
  currentExercise,
}) => {
  // 监听键盘 Enter 回车快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (status === 'unanswered' && hasInput) {
          e.preventDefault();
          onCheck();
        } else if (status === 'correct' || status === 'incorrect') {
          e.preventDefault();
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, hasInput, onCheck, onNext]);

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 border-t-2 ${
        status === 'correct'
          ? 'bg-[#d7ffb8] border-[#58cc02]'
          : status === 'incorrect'
          ? 'bg-[#ffdfe0] border-[#ea2b2b]'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Feedback Info */}
        {status === 'unanswered' && (
          <div className="hidden sm:flex items-center text-xs font-bold text-slate-400">
            <span>支持按 Enter 快速核对答案</span>
          </div>
        )}

        {status === 'correct' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
              <Check className="w-7 h-7 text-[#58cc02] stroke-[3.5]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#58cc02] leading-tight">
                非常好！
              </h3>
              <p className="text-xs sm:text-sm font-bold text-emerald-800">
                {evaluationResult?.encouragement || '读词完整，继续保持！'}
              </p>
            </div>
          </div>
        )}

        {status === 'incorrect' && (
          <div className="flex items-start gap-3 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <X className="w-7 h-7 text-[#ea2b2b] stroke-[3.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#ea2b2b] leading-tight">
                别灰心！标准西语表达：
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-rose-900">
                  {currentExercise.spanish}
                </span>
                <button
                  onClick={() => {
                    soundEffects.playClickSound();
                    TTSService.speak(currentExercise.spanish, 0.85);
                  }}
                  title="听标准发音"
                  className="p-1 text-rose-600 hover:text-rose-800 rounded-md hover:bg-rose-100"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {status === 'unanswered' && (
            <>
              {/* Skip Button */}
              <button
                onClick={() => {
                  soundEffects.playClickSound();
                  onSkip();
                }}
                className="duo-btn-gray px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                <SkipForward className="w-4 h-4" />
                <span>跳过这题</span>
              </button>

              {/* Check Answer Button */}
              <button
                onClick={() => {
                  if (hasInput) {
                    onCheck();
                  }
                }}
                disabled={!hasInput}
                className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
                  hasInput
                    ? 'duo-btn-green shadow-xs'
                    : 'bg-[#e5e5e5] text-[#afafaf] border-b-4 border-[#cecece] cursor-not-allowed'
                }`}
              >
                <span>核对答案</span>
              </button>
            </>
          )}

          {status === 'correct' && (
            <button
              onClick={() => {
                soundEffects.playClickSound();
                onNext();
              }}
              className="duo-btn-green w-full sm:w-auto px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>继续下一题</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {status === 'incorrect' && (
            <button
              onClick={() => {
                soundEffects.playClickSound();
                onNext();
              }}
              className="duo-btn-red w-full sm:w-auto px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>继续</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
