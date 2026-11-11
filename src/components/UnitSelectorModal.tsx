/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';
import type { CatalogChapter } from '../services/api';
import { soundEffects } from '../services/soundEffects';

interface UnitSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: CatalogChapter[];
  selectedUnitId: string | 'all';
  onSelectUnit: (unitId: string | 'all') => void;
}

export const UnitSelectorModal: React.FC<UnitSelectorModalProps> = ({
  isOpen,
  onClose,
  chapters,
  selectedUnitId,
  onSelectUnit,
}) => {
  if (!isOpen) return null;
  const unitsList = chapters.map(chapter => ({
    id: chapter.id, name: chapter.name, count: chapter.sentenceCount, icon: chapter.icon,
  }));
  const totalQuestions = chapters.reduce((total, chapter) => total + chapter.sentenceCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">
                选择西班牙语口语单元
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                自由切换场景专项突破或综合练习
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

        {/* Units list */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {/* All Units Option */}
          <button
            onClick={() => {
              soundEffects.playClickSound();
              onSelectUnit('all');
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
              selectedUnitId === 'all'
                ? 'border-[#58cc02] bg-[#f2fbe9] shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black">
                🌟
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-sm sm:text-base">
                  全部单元综合口语练习
                </h4>
                <p className="text-xs text-slate-500 font-bold">
                  包含 {unitsList.length} 个主题，共 {totalQuestions} 道精选原声发音句
                </p>
              </div>
            </div>

            {selectedUnitId === 'all' && (
              <CheckCircle2 className="w-6 h-6 text-[#58cc02]" />
            )}
          </button>

          {/* Individual Units */}
          {unitsList.map((unit) => {
            const isSelected = selectedUnitId === unit.id;
            return (
              <button
                key={unit.id}
                disabled={unit.count === 0}
                onClick={() => {
                  soundEffects.playClickSound();
                  onSelectUnit(unit.id);
                  onClose();
                }}
                className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-[#1cb0f6] bg-[#f0f9ff] shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    {unit.icon ? <span className="text-xl">{unit.icon}</span> : <Layers className="w-5 h-5 text-slate-600" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm sm:text-base">
                      {unit.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-bold">
                      {unit.count ? `${unit.count} 句核心地道口语` : '暂无句子'}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="w-6 h-6 text-[#1cb0f6]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
