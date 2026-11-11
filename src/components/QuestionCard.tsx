/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2, Star, ChevronDown, ChevronUp, Sparkles, BookOpen } from 'lucide-react';
import { Exercise } from '../types';
import { DuoOwl, OwlMood } from './DuoOwl';
import { TTSService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';

interface QuestionCardProps {
  exercise: Exercise;
  isStarred: boolean;
  onToggleStar: (id: string) => void;
  owlMood: OwlMood;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  exercise,
  isStarred,
  onToggleStar,
  owlMood,
}) => {
  const [isPlayingTTS, setIsPlayingTTS] = useState<boolean>(false);
  const [playingRate, setPlayingRate] = useState<number | null>(null);
  const [showGrammarTip, setShowGrammarTip] = useState<boolean>(false);
  const [activeHintIndex, setActiveHintIndex] = useState<number | null>(null);
  const [failedImage, setFailedImage] = useState('');

  useEffect(() => {
    TTSService.schedule(exercise.spanish, 1000,
      () => { setIsPlayingTTS(true); setPlayingRate(1); },
      () => { setIsPlayingTTS(false); setPlayingRate(null); });
    return () => TTSService.stop();
  }, [exercise.id, exercise.spanish]);

  const handlePlayTTS = (rate: number) => {
    soundEffects.playClickSound();
    setIsPlayingTTS(true);
    setPlayingRate(rate);

    TTSService.speak(
      exercise.spanish,
      rate,
      () => {
        setIsPlayingTTS(true);
      },
      () => {
        setIsPlayingTTS(false);
        setPlayingRate(null);
      }
    );
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
      {/* Title / Category line */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[#58cc02]" />
          <span>{exercise.unitName}</span>
          <span className="text-slate-300">·</span>
          <span className="text-[#58cc02] uppercase tracking-wider font-black">
            {exercise.difficulty === 'easy'
              ? '初级基础'
              : exercise.difficulty === 'medium'
              ? '进阶口语'
              : '高阶地道'}
          </span>
        </div>

        {/* Star Button */}
        <button
          onClick={() => {
            soundEffects.playClickSound();
            onToggleStar(exercise.id);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
            isStarred
              ? 'bg-amber-100 text-amber-700 border border-amber-300'
              : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 border border-transparent'
          }`}
          title={isStarred ? '已加入难点错题集（点击取消）' : '标记为难点题（加入专项复习）'}
        >
          <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
          <span>{isStarred ? '已星标难点' : '标记难点'}</span>
        </button>
      </div>

      {exercise.imageUrl && exercise.imageUrl !== failedImage && (
        <figure className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2">
          <img src={exercise.imageUrl} alt={exercise.name ? `${exercise.name}配图` : '句子配图'} className="max-h-64 w-full rounded-xl object-contain" onError={() => setFailedImage(exercise.imageUrl || '')} />
        </figure>
      )}

      {/* Main Duo Owl & Speech Bubble Container */}
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Owl Mascot */}
        <div className="pt-2 shrink-0">
          <DuoOwl mood={owlMood} size={100} />
        </div>

        {/* Speech Bubble */}
        <div className="flex-1 relative bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          {/* Bubble Pointer Triangle */}
          <div className="absolute top-8 -left-2.5 w-4 h-4 bg-white border-l-2 border-b-2 border-slate-200 rotate-45 transform" />

          {/* Audio Controls + Spanish Target Text */}
          <div className="flex items-start gap-2.5 mb-2.5">
            {/* Audio Buttons */}
            <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
              {/* Normal Speed 1.0x */}
              <button
                onClick={() => handlePlayTTS(1.0)}
                disabled={isPlayingTTS && playingRate === 1.0}
                title="原速朗读 (1.0x)"
                className="w-10 h-10 rounded-2xl bg-[#1cb0f6] hover:bg-[#20bdff] border-b-3 border-[#1899d6] flex items-center justify-center text-white active:translate-y-0.5 transition-all shadow-xs"
              >
                <Volume2 className="w-5 h-5" />
              </button>

              {/* Turtle Slow Speed 0.6x */}
              <button
                onClick={() => handlePlayTTS(0.6)}
                disabled={isPlayingTTS && playingRate === 0.6}
                title="乌龟慢速朗读 (0.6x)"
                className="w-10 h-10 rounded-2xl bg-[#ff9600] hover:bg-[#ffa726] border-b-3 border-[#e08400] flex items-center justify-center text-white active:translate-y-0.5 transition-all shadow-xs text-lg select-none"
              >
                🐢
              </button>
            </div>

            {/* Target Spanish Sentence */}
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-snug">
                {exercise.spanish}
              </h2>

              {/* Phonetic Pronunciation Approximation */}
              <p className="text-xs text-slate-400 font-bold mt-1 tracking-wide font-mono">
                拼读：[{exercise.phonetics}]
              </p>
            </div>
          </div>

          {/* Chinese Translation Prompt */}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm sm:text-base font-extrabold text-slate-600">
              {exercise.chinese}
            </p>
          </div>

          {/* Vocab Hints Chips */}
          {exercise.vocabHints && exercise.vocabHints.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 mr-2">生词速查：</span>
              <div className="inline-flex flex-wrap gap-1.5 mt-1">
                {exercise.vocabHints.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      soundEffects.playClickSound();
                      setActiveHintIndex(activeHintIndex === i ? null : i);
                      TTSService.speak(hint.es, 0.85);
                    }}
                    className={`text-xs px-2 py-0.5 rounded-lg border font-bold transition-all ${
                      activeHintIndex === i
                        ? 'bg-sky-100 border-sky-300 text-sky-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{hint.es}</span>
                    <span className="text-[10px] text-slate-400 ml-1">({hint.zh})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grammar & Culture Tip Card (Collapsible) */}
      {exercise.grammarTip && (
        <div className="w-full bg-amber-50/70 border border-amber-200 rounded-2xl overflow-hidden shadow-xs transition-all">
          <button
            onClick={() => {
              soundEffects.playClickSound();
              setShowGrammarTip(!showGrammarTip);
            }}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-black text-amber-800 hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>西语地道用法与语法小贴士</span>
            </div>
            {showGrammarTip ? (
              <ChevronUp className="w-4 h-4 text-amber-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-600" />
            )}
          </button>

          {showGrammarTip && (
            <div className="px-4 pb-3 pt-1 text-xs text-amber-900 leading-relaxed font-semibold border-t border-amber-200/50">
              {exercise.grammarTip}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
