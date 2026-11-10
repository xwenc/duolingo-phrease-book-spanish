/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 类型定义扩充以支持浏览器 Web Speech API
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

// 扩展全局类型
type SpeechRecognitionConstructor = new () => IWindowSpeechRecognition;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const anyWin = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return anyWin.SpeechRecognition || anyWin.webkitSpeechRecognition || null;
}

/**
 * 语音发音 (TTS) 服务：基于原生 SpeechSynthesis API
 */
export class TTSService {
  private static cachedVoice: SpeechSynthesisVoice | null = null;
  private static voicesLoaded: boolean = false;

  private static initVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // 优先寻找西班牙本土标准音 (es-ES)，其次寻找拉美西语 (es-*)
        const esVoice =
          voices.find((v) => v.lang === 'es-ES' || v.lang === 'es_ES') ||
          voices.find((v) => v.lang.toLowerCase().startsWith('es')) ||
          null;
        TTSService.cachedVoice = esVoice;
        TTSService.voicesLoaded = true;
      }
    };

    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  /**
   * 播放西语朗读
   * @param text 西语文本
   * @param speed 语速：1.0 为标准，0.6 为乌龟慢速
   * @param onStart 开始播放回调
   * @param onEnd 结束播放回调
   */
  public static speak(
    text: string,
    speed: number = 1.0,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis API 不受当前环境支持');
      return;
    }

    if (!TTSService.voicesLoaded) {
      TTSService.initVoices();
    }

    window.speechSynthesis.cancel(); // 停止当前正在播放的发音

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = speed;
    utterance.pitch = 1.0;

    if (TTSService.cachedVoice) {
      utterance.voice = TTSService.cachedVoice;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  public static stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

/**
 * 语音识别 (STT) 服务：基于原生 Web Speech API
 */
export interface STTListenerCallbacks {
  onStart?: () => void;
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

export class STTService {
  private recognition: IWindowSpeechRecognition | null = null;
  private isListening: boolean = false;

  public static isSupported(): boolean {
    return !!getSpeechRecognitionClass();
  }

  public startListening(callbacks: STTListenerCallbacks) {
    const SpeechRecClass = getSpeechRecognitionClass();
    if (!SpeechRecClass) {
      callbacks.onError?.('当前浏览器不支持麦克风语音识别，建议切换为键盘输入模式。');
      return;
    }

    this.stopListening();

    try {
      this.recognition = new SpeechRecClass();
      this.recognition.lang = 'es-ES'; // 标准卡斯蒂利亚西班牙语
      this.recognition.interimResults = true; // 实时流式转写
      this.recognition.continuous = false;

      let finalTrans = '';

      this.recognition.onstart = () => {
        this.isListening = true;
        callbacks.onStart?.();
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript;
          } else {
            interimTrans += item[0].transcript;
          }
        }

        const currentText = (finalTrans + ' ' + interimTrans).trim();
        callbacks.onInterimResult?.(currentText);
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.isListening = false;
        let msg = '识别发生未知错误';
        if (event.error === 'not-allowed') {
          msg = '请允许网页访问麦克风权限后重试，或改用键盘输入。';
        } else if (event.error === 'no-speech') {
          msg = '未检测到声音，请按住麦克风大声朗读。';
        } else if (event.error === 'network') {
          msg = '语音服务连接超时，已为你保留录音状态。';
        }
        callbacks.onError?.(msg);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (finalTrans.trim()) {
          callbacks.onFinalResult?.(finalTrans.trim());
        }
        callbacks.onEnd?.();
      };

      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      callbacks.onError?.('启动录音失败，请检查浏览器权限。');
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const sttService = new STTService();
