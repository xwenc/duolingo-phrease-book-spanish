/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API 原生音效合成引擎，无需依赖任何外部 MP3 音频文件
class SoundEffectsService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // 读取持久化静音设置
    try {
      const savedMute = localStorage.getItem('duo_audio_muted');
      if (savedMute !== null) {
        this.isMuted = JSON.parse(savedMute);
      }
    } catch {
      this.isMuted = false;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('duo_audio_muted', JSON.stringify(muted));
    } catch {
      // ignore
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * 多邻国标志性答对音效：清脆三和弦琶音 (C5 -> E5 -> G5 -> C6)
   */
  public playCorrectSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.18 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.18 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.22 }, // G5
      { freq: 1046.50, time: 0.24, dur: 0.45 }, // C6
    ];

    const now = ctx.currentTime;

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.22, now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.dur);
    });
  }

  /**
   * 多邻国柔和错误音效：沉稳低音双音轻声提醒 (Db3 -> C3 柔和蜂鸣)
   */
  public playIncorrectSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 音调 1: 138.59 Hz (Db3)
    // 音调 2: 123.47 Hz (B2)
    const tones = [
      { freq: 164.81, time: 0.0, dur: 0.18 },
      { freq: 130.81, time: 0.15, dur: 0.35 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // 使用三角形波 + 低通滤波，避免刺耳，呈现Duolingo温暖的蜂鸣感
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(tone.freq, now + tone.time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now + tone.time);

      gain.gain.setValueAtTime(0, now + tone.time);
      gain.gain.linearRampToValueAtTime(0.25, now + tone.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.time + tone.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + tone.time);
      osc.stop(now + tone.time + tone.dur);
    });
  }

  /**
   * 扣除红心生命值音效
   */
  public playHeartLostSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * 通关庆祝大合奏 (Fanfare)
   */
  public playCompleteSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chords = [
      { freq: 523.25, time: 0.0, dur: 0.2 },
      { freq: 659.25, time: 0.12, dur: 0.2 },
      { freq: 783.99, time: 0.24, dur: 0.2 },
      { freq: 1046.5, time: 0.36, dur: 0.5 },
      { freq: 1318.5, time: 0.48, dur: 0.65 },
    ];

    chords.forEach((c) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(c.freq, now + c.time);

      gain.gain.setValueAtTime(0, now + c.time);
      gain.gain.linearRampToValueAtTime(0.2, now + c.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + c.time + c.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + c.time);
      osc.stop(now + c.time + c.dur);
    });
  }

  /**
   * 按钮点击轻微触感音效
   */
  public playClickSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }
}

export const soundEffects = new SoundEffectsService();
