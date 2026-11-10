/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Star, Volume2, Trash2, Play, Sparkles } from 'lucide-react';
import { Exercise } from '../types';
import { TTSService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';

interface DifficultiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  starredExercises: Exercise[];
  onRemoveStar: (id: string) => void;
  onStartStarredPractice: () => void;
}

export const DifficultiesModal: React.FC<DifficultiesModalProps> = ({
  isOpen,
  onClose,
  starredExercises,
  onRemoveStar,
  onStartStarredPractice,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">
                难点错题专项练习库
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                已星标收藏 {starredExercises.length} 道高频卡壳题
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playClickSound();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          {starredExercises.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                <Star className="w-8 h-8" />
              </div>
              <div>
                <p className="font-extrabold text-slate-600 text-sm">
                  暂无星标难点题目
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  在练习过程中，遇到发音困难或陌生的西语句子，点击右上角的 ⭐ 即可加入此处针对性复习！
                </p>
              </div>
            </div>
          ) : (
            starredExercises.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl p-3.5 flex items-start justify-between gap-3 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {item.unitName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      [{item.phonetics}]
                    </span>
                  </div>

                  <p className="text-base font-black text-slate-800 mt-1.5">
                    {item.spanish}
                  </p>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    {item.chinese}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      soundEffects.playClickSound();
                      TTSService.speak(item.spanish, 0.85);
                    }}
                    title="听发音"
                    className="p-2 text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playClickSound();
                      onRemoveStar(item.id);
                    }}
                    title="移出难点库"
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {starredExercises.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                soundEffects.playClickSound();
                onClose();
              }}
              className="duo-btn-gray px-4 py-2.5 rounded-xl font-bold text-xs"
            >
              关闭
            </button>

            <button
              onClick={() => {
                soundEffects.playClickSound();
                onStartStarredPractice();
              }}
              className="duo-btn-yellow px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>专项攻克所有难点 ({starredExercises.length} 题)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
