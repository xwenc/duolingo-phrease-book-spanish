/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, Sparkles, RefreshCw } from 'lucide-react';
import { DuoOwl } from './DuoOwl';
import { soundEffects } from '../services/soundEffects';

interface HeartRestockModalProps {
  isOpen: boolean;
  onRefillFull: () => void;
  onRefillOne: () => void;
  onClose: () => void;
}

export const HeartRestockModal: React.FC<HeartRestockModalProps> = ({
  isOpen,
  onRefillFull,
  onRefillOne,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full border-2 border-slate-200 shadow-2xl p-6 flex flex-col items-center text-center">
        {/* Sad Duo Owl */}
        <div className="mb-2">
          <DuoOwl mood="sad" size={110} />
        </div>

        {/* Broken Heart Icon */}
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-3">
          <Heart className="w-7 h-7 fill-current" />
        </div>

        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          红心生命值已耗尽！
        </h2>
        <p className="text-sm font-bold text-slate-500 mt-1 mb-6 max-w-xs">
          练习口语犯错很正常，熟能生巧！选择以下方式迅速回血恢复练习：
        </p>

        {/* Options */}
        <div className="w-full flex flex-col gap-3">
          {/* Option 1: Instant Full Refill */}
          <button
            onClick={() => {
              soundEffects.playCorrectSound();
              onRefillFull();
            }}
            className="duo-btn-green w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>立即加满生命值 (+5 ❤️)</span>
          </button>

          {/* Option 2: Quick Review +1 */}
          <button
            onClick={() => {
              soundEffects.playClickSound();
              onRefillOne();
            }}
            className="duo-btn-blue w-full py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>快速重整旗鼓 (+1 ❤️)</span>
          </button>

          {/* Option 3: Cancel / Take a break */}
          <button
            onClick={() => {
              soundEffects.playClickSound();
              onClose();
            }}
            className="duo-btn-gray w-full py-2.5 px-4 rounded-2xl font-bold text-xs"
          >
            先休息一会儿
          </button>
        </div>
      </div>
    </div>
  );
};
