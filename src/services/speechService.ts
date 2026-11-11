/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { api } from './api';
import { encodeWav } from './pcmAudio';

/** Native Ming TTS synthesis. The browser only plays the returned WAV. */
export class TTSService {
  private static audio: HTMLAudioElement | null = null;
  private static autoplayTimer: ReturnType<typeof setTimeout> | undefined;
  private static finish: (() => void) | null = null;

  public static schedule(text: string, delay: number, onStart?: () => void, onEnd?: () => void) {
    TTSService.stop();
    TTSService.autoplayTimer = setTimeout(() => {
      TTSService.autoplayTimer = undefined;
      TTSService.speak(text, 1, onStart, onEnd);
    }, delay);
  }

  public static speak(text: string, speed = 1, onStart?: () => void, onEnd?: () => void) {
    TTSService.stop();
    const query = new URLSearchParams({ text, speed: String(speed) });
    const audio = new Audio(`/api/tts?${query}`);
    TTSService.audio = audio;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      audio.onended = null; audio.onerror = null; audio.onplaying = null;
      if (TTSService.audio === audio) { TTSService.audio = null; TTSService.finish = null; }
      onEnd?.();
    };
    const fail = (error?: unknown) => {
      if (finished) return;
      const blocked = error instanceof Error && error.name === 'NotAllowedError';
      window.dispatchEvent(new CustomEvent('tts-error', { detail: blocked
        ? '浏览器阻止了自动播放，请点击喇叭播放示范朗读。'
        : '本地朗读播放失败，请稍后再试；若登录已过期，请重新登录。' }));
      finish();
    };
    TTSService.finish = finish;
    audio.onplaying = () => onStart?.();
    audio.onended = finish;
    audio.onerror = fail;
    // Call play directly in the click handler, preserving mobile browser activation.
    void audio.play().catch(fail);
  }

  public static stop() {
    clearTimeout(TTSService.autoplayTimer);
    TTSService.autoplayTimer = undefined;
    const audio = TTSService.audio;
    if (audio) {
      audio.pause();
      TTSService.finish?.();
      audio.removeAttribute('src'); audio.load();
    }
  }
}

/**
 * 语音识别 (STT)：AudioWorklet 连续采集，WAV快照交给 macOS 原生 faster-whisper
 */
export interface STTListenerCallbacks {
  onStart?: () => void;
  onInterimResult?: (transcript: string) => void;
  onWarning?: (message: string) => void;
  onProcessing?: () => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

export class STTService {
  private cleanup: (() => void) | null = null;
  private stop: (() => void) | null = null;
  private generation = 0;
  public static isSupported() {
    return typeof AudioContext !== 'undefined' && typeof AudioWorkletNode !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }
  public async startListening(callbacks: STTListenerCallbacks) {
    this.cancel();
    const generation = this.generation;
    const active = () => generation === this.generation;
    if (!STTService.isSupported()) { callbacks.onError?.('当前浏览器不支持实时录音，请使用HTTPS和新版浏览器，或改用键盘。'); callbacks.onEnd?.(); return; }
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let node: AudioWorkletNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let flushDone: (() => void) | null = null;
    let stopping = false, inFlight = false, finalized = false;
    let revision = 0, sentRevision = 0, latestText = '';
    const chunks: Float32Array[] = [];
    const release = () => {
      clearInterval(interval); clearTimeout(timer);
      source?.disconnect(); node?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== 'closed') void context.close();
    };
    const finish = () => {
      if (finalized) return;
      finalized = true; release();
      if (active()) { this.stop = null; this.cleanup = null; callbacks.onEnd?.(); }
    };
    const upload = async () => {
      if (!active() || finalized || inFlight) return;
      if (!chunks.length || (!stopping && (revision === sentRevision || chunks.reduce((n, c) => n + c.length, 0) < (context?.sampleRate ?? 48000) * 0.5))) {
        if (stopping) { callbacks.onFinalResult?.(latestText); finish(); }
        return;
      }
      const finalRequest = stopping;
      sentRevision = revision;
      const form = new FormData();
      form.append('audio', encodeWav(chunks, context!.sampleRate), 'recording.wav');
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 120000);
      try {
        const result = await api<{ transcript: string }>('/speech', { method: 'POST', body: form, signal: controller.signal });
        if (active()) {
          latestText = result.transcript;
          if (finalRequest) callbacks.onFinalResult?.(latestText);
          else callbacks.onInterimResult?.(latestText);
        }
      } catch (err) {
        // Silence/busy during a partial snapshot should not terminate capture.
        if (active()) {
          if (finalRequest) callbacks.onError?.((err as Error).message);
          else { sentRevision = -1; callbacks.onWarning?.('自动转写暂未成功，正在继续录音并重试。'); }
        }
      } finally {
        clearTimeout(timeout); inFlight = false;
        if (active()) {
          if (finalRequest) finish();
          else if (stopping) void upload();
        }
      }
    };
    this.cleanup = () => { controller?.abort(); flushDone?.(); release(); };
    try {
      context = new AudioContext();
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (!active()) { release(); return; }
      await context.audioWorklet.addModule(new URL('./pcm-recorder.worklet.js', import.meta.url).href);
      if (!active()) { release(); return; }
      node = new AudioWorkletNode(context, 'pcm-recorder');
      source = context.createMediaStreamSource(stream);
      node.port.onmessage = ({ data }) => {
        if (!active()) return;
        if (data.samples) {
          const samples = data.samples as Float32Array;
          chunks.push(samples);
          const energy = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
          if (energy > 0.000064) revision++;
        }
        if (data.flushed) flushDone?.();
      };
      source.connect(node);
      // Worklet outputs silence; connecting it keeps processing active without mic feedback.
      node.connect(context.destination);
      this.stop = () => {
        if (stopping) return;
        stopping = true; clearInterval(interval); clearTimeout(timer);
        callbacks.onProcessing?.();
        source?.disconnect();
        const flushTimeout = setTimeout(() => flushDone?.(), 300);
        flushDone = () => {
          clearTimeout(flushTimeout); flushDone = null;
          release(); void upload();
        };
        node?.port.postMessage('flush');
      };
      callbacks.onStart?.();
      interval = setInterval(() => { void upload(); }, 1500);
      timer = setTimeout(() => this.stopListening(), 55000);
    } catch {
      release();
      if (active()) { callbacks.onError?.('无法启动实时录音，请检查麦克风权限。'); finish(); }
    }
  }
  public stopListening() { this.stop?.(); }
  public cancel() {
    this.generation++;
    this.cleanup?.(); this.cleanup = null; this.stop = null;
  }
  public getIsListening() { return this.stop !== null; }
}
export const sttService = new STTService();
