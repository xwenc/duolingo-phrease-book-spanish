/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Keyboard, RotateCcw, Sparkles } from 'lucide-react';
import { sttService, STTService, TTSService } from '../services/speechService';
import { soundEffects } from '../services/soundEffects';

interface SpeechRecorderProps {
  onTranscriptChange: (text: string) => void;
  currentTranscript: string;
  isEvaluating: boolean;
  onAutoSubmit?: (text: string) => void;
  disabled?: boolean;
  shortcutsEnabled?: boolean;
}

export const SpeechRecorder: React.FC<SpeechRecorderProps> = ({
  onTranscriptChange,
  currentTranscript,
  isEvaluating,
  disabled = false,
  shortcutsEnabled = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  useEffect(() => () => sttService.cancel(), []);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isSupported] = useState<boolean>(STTService.isSupported());

  // 若不支持语音识别，默认切换至键盘模式
  useEffect(() => {
    if (!isSupported) {
      setIsKeyboardMode(true);
    }
  }, [isSupported]);

  // 当外部清空或进入下一题时停止录音
  useEffect(() => {
    if (disabled && isRecording) {
      handleStopRecord();
    }
  }, [disabled]);

  const handleStartRecord = (restart = false) => {
    if (disabled || isEvaluating || (isProcessing && !restart)) return;
    TTSService.stop();
    setIsProcessing(true);
    setRecordingError(null);
    soundEffects.playClickSound();

    sttService.startListening({
      onStart: () => {
        setIsProcessing(false);
        setIsRecording(true);
        onTranscriptChange('');
      },
      onWarning: (message) => setRecordingError(message),
      onProcessing: () => { setIsRecording(false); setIsProcessing(true); },
      onInterimResult: (interim) => {
        setRecordingError(null);
        onTranscriptChange(interim);
      },
      onFinalResult: (final) => {
        onTranscriptChange(final);
      },
      onError: (errMsg) => {
        setIsProcessing(false);
        setIsRecording(false);
        setRecordingError(errMsg);
      },
      onEnd: () => {
        setIsProcessing(false);
        setIsRecording(false);
      },
    });
  };

  const handleRestartRecord = () => {
    if (disabled || isEvaluating) return;
    // Invalidate the old session before clearing so late replies cannot restore old text.
    sttService.cancel();
    setIsRecording(false);
    setRecordingError(null);
    onTranscriptChange('');
    handleStartRecord(true);
  };

  const handleStopRecord = () => {
    soundEffects.playClickSound();
    sttService.stopListening();
    setIsRecording(false);
    setIsProcessing(true);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      handleStopRecord();
    } else {
      handleStartRecord();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shortcutsEnabled || disabled || isEvaluating || isKeyboardMode || !isSupported ||
          event.defaultPrevented || event.repeat || event.isComposing ||
          event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const isSpace = event.code === 'Space' || event.key === ' ';
      const isRestart = event.key.toLowerCase() === 'r';
      if (!isSpace && !isRestart) return;
      // Keep native Space activation for unrelated controls; recorder controls use
      // the shortcut once instead of also triggering a synthesized button click.
      if (isSpace && target?.closest('button, a, summary, [role="button"]') &&
          !target.closest('[data-recording-control]')) return;
      event.preventDefault();
      if (isRestart) handleRestartRecord();
      else if (!isProcessing) handleToggleRecord();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleInsertChar = (char: string) => {
    soundEffects.playClickSound();
    onTranscriptChange(currentTranscript + char);
  };

  const handleClear = () => {
    soundEffects.playClickSound();
    onTranscriptChange('');
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 my-2">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between w-full max-w-lg px-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#1cb0f6]" />
          {isKeyboardMode ? '键盘输入模式' : '西班牙语录音练习'}
        </span>

        <button
          onClick={() => {
            soundEffects.playClickSound();
            sttService.cancel(); setIsRecording(false); setIsProcessing(false);
            setIsKeyboardMode(!isKeyboardMode);
          }}
          className="text-xs font-extrabold text-[#1cb0f6] hover:text-[#1899d6] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-sky-50 transition-colors"
        >
          {isKeyboardMode ? (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>切回语音练习</span>
            </>
          ) : (
            <>
              <Keyboard className="w-3.5 h-3.5" />
              <span>改用键盘输入</span>
            </>
          )}
        </button>
      </div>

      {/* Main Input/Recording Area */}
      {!isKeyboardMode ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-lg">
          {/* Duolingo Large 3D Mic Button */}
          <div className="relative flex items-center justify-center my-2">
            {/* Pulsing ring when recording */}
            {isRecording && (
              <>
                <div className="absolute w-28 h-28 rounded-full bg-[#1cb0f6]/20 animate-ping" />
                <div className="absolute w-24 h-24 rounded-full bg-[#1cb0f6]/30 animate-pulse" />
              </>
            )}

            <button
              onClick={handleToggleRecord}
              data-recording-control
              aria-keyshortcuts="Space"
              disabled={disabled || isEvaluating || isProcessing}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
                isRecording
                  ? 'bg-[#ff4b4b] border-b-4 border-[#ea2b2b] text-white active:translate-y-1'
                  : 'bg-[#1cb0f6] hover:bg-[#20bdff] border-b-4 border-[#1899d6] text-white active:translate-y-1'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? '点击结束录音' : '点击开始口语朗读'}
            >
              {isRecording ? (
                <MicOff className="w-8 h-8 animate-bounce" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Audio Wave Visualizer Bars when recording */}
          {isRecording ? (
            <div className="flex items-center gap-1.5 h-8">
              <span className="w-1.5 bg-[#1cb0f6] rounded-full animate-[wave-bar_0.8s_ease-in-out_infinite]" />
              <span className="w-1.5 bg-[#1cb0f6] rounded-full animate-[wave-bar_0.8s_ease-in-out_0.2s_infinite]" />
              <span className="w-1.5 bg-[#1cb0f6] rounded-full animate-[wave-bar_0.8s_ease-in-out_0.4s_infinite]" />
              <span className="w-1.5 bg-[#1cb0f6] rounded-full animate-[wave-bar_0.8s_ease-in-out_0.1s_infinite]" />
              <span className="w-1.5 bg-[#1cb0f6] rounded-full animate-[wave-bar_0.8s_ease-in-out_0.3s_infinite]" />
              <span className="text-xs font-black text-[#1cb0f6] ml-2 animate-pulse">
                正在录音并自动转写…
              </span>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-400">
              {isProcessing ? '正在处理录音，请稍候…' : '点击开始，说话后自动转写；再次点击结束'}
            </p>
          )}

          <p className="text-xs text-slate-400 font-bold">快捷键：空格 开始/结束录音 · R 清除并重录</p>

          {/* Live Transcript Bubble */}
          <div className="w-full bg-white rounded-2xl border-2 border-slate-200 p-3.5 min-h-[58px] flex items-center justify-between shadow-xs">
            <div className="flex-1 pr-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                实时转写：
              </div>
              <p
                className={`text-sm sm:text-base font-bold ${
                  currentTranscript ? 'text-slate-800' : 'text-slate-300 italic'
                }`}
              >
                {currentTranscript || '（等待你的声音...）'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRestartRecord}
              data-recording-control
              aria-keyshortcuts="R"
              disabled={disabled || isEvaluating || !isSupported}
              title="清除转写并立即重新录音"
              aria-label="清除转写并立即重新录音"
              className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs font-bold text-[#1cb0f6] hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              <span>清除并重录</span>
            </button>
          </div>

          {recordingError && (
            <div className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-bold">
              {recordingError}
            </div>
          )}
        </div>
      ) : (
        /* Keyboard Input Mode */
        <div className="w-full max-w-lg flex flex-col gap-2.5">
          <div className="relative">
            <textarea
              value={currentTranscript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder="在此输入西班牙语句子..."
              rows={2}
              className="w-full bg-white border-2 border-slate-200 focus:border-[#1cb0f6] focus:outline-none rounded-2xl p-3.5 text-slate-800 font-bold text-sm sm:text-base shadow-xs resize-none"
            />
            {currentTranscript && (
              <button
                onClick={handleClear}
                title="清空输入"
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Spanish Accents Virtual Keys */}
          <div className="flex items-center flex-wrap gap-1.5 justify-center bg-slate-100 p-2 rounded-xl border border-slate-200">
            <span className="text-[11px] font-extrabold text-slate-500 mr-1">快捷西语符号:</span>
            {['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'].map((char) => (
              <button
                key={char}
                onClick={() => handleInsertChar(char)}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-700 shadow-xs active:translate-y-0.5 transition-all"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
