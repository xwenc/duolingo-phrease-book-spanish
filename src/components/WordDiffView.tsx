/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, XCircle, Volume2, AlertCircle } from 'lucide-react';
import { DiffToken } from '../types';
import { TTSService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';

interface WordDiffViewProps {
  diffTokens: DiffToken[];
  rawSpoken: string;
  isPassed: boolean;
  score: number;
}

export const WordDiffView: React.FC<WordDiffViewProps> = ({
  diffTokens,
  rawSpoken,
  isPassed,
  score,
}) => {
  const handlePlayWord = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClickSound();
    TTSService.speak(word, 0.8);
  };

  return (
    <div className="w-full bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
              isPassed ? 'bg-[#58cc02] text-white' : 'bg-[#ff4b4b] text-white'
            }`}
          >
            {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : '!'}
          </div>
          <span className="text-sm font-extrabold text-slate-800">
            逐词发音比对评测
          </span>
        </div>

        {/* Accuracy Score */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-bold">发音匹配度:</span>
          <span
            className={`text-sm font-black tabular-nums ${
              score >= 80 ? 'text-[#58cc02]' : score >= 60 ? 'text-[#ff9600]' : 'text-[#ff4b4b]'
            }`}
          >
            {score}%
          </span>
        </div>
      </div>

      {/* Diff Tokens Grid */}
      <div className="flex flex-wrap items-center gap-2.5 my-3">
        {diffTokens.map((token, idx) => {
          if (token.status === 'correct') {
            return (
              <button
                key={idx}
                onClick={(e) => handlePlayWord(token.text, e)}
                title="发音纯正！点击单读此词"
                className="group inline-flex flex-col items-center px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1 text-[#46a302] font-black text-base sm:text-lg">
                  <span>{token.text}</span>
                  <Check className="w-3.5 h-3.5 stroke-[3] text-[#58cc02]" />
                </div>
                <span className="text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  点击朗读
                </span>
              </button>
            );
          }

          if (token.status === 'mispronounced') {
            return (
              <button
                key={idx}
                onClick={(e) => handlePlayWord(token.text, e)}
                title={`误读发音，识别为: "${token.userWord}"。点击听标准发音`}
                className="group inline-flex flex-col items-center px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-400 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-1 text-rose-600 font-black text-base sm:text-lg">
                  <span>{token.text}</span>
                  <Volume2 className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-[10px] text-rose-600 font-extrabold flex items-center gap-0.5">
                  <span>读成:</span>
                  <span className="line-through">{token.userWord || '偏差'}</span>
                </div>
              </button>
            );
          }

          // Missing
          return (
            <button
              key={idx}
              onClick={(e) => handlePlayWord(token.text, e)}
              title="遗漏未读出该单词，点击听标准发音"
              className="group inline-flex flex-col items-center px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border-2 border-dashed border-amber-400 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1 text-amber-700 font-black text-base sm:text-lg">
                <span>{token.text}</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-[10px] text-amber-600 font-extrabold">
                遗漏未读
              </span>
            </button>
          );
        })}
      </div>

      {/* Spoken transcript summary */}
      {rawSpoken && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="truncate">
            <span className="font-bold text-slate-700">你的录音识别：</span>
            <span className="italic text-slate-600">“{rawSpoken}”</span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0">
            提示：点击任意单词可单读发音
          </span>
        </div>
      )}
    </div>
  );
};
