import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { STTService } from './speechService.ts';
import { encodeWav } from './pcmAudio.ts';

function environment(t) {
  let node;
  let stopped = 0;
  class Context {
    sampleRate = 48000;
    state = 'running';
    destination = {};
    audioWorklet = { addModule: async () => {} };
    async resume() {}
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  class Worklet {
    constructor() {
      node = this;
      this.port = { onmessage: null, postMessage: () => this.port.onmessage({ data: { flushed: true } }) };
    }
    connect() {}
    disconnect() {}
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ transcript: 'hola' }), { headers: { 'Content-Type':'application/json' } }));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) } } });
  globalThis.AudioContext = Context;
  globalThis.AudioWorkletNode = Worklet;
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  return {
    feed() { for (let i=0;i<16;i++) node.port.onmessage({ data: { samples: new Float32Array(2048).fill(0.1) } }); },
    get stopped() { return stopped; },
  };
}

test('WAV snapshot has an independent header and resamples to 16kHz', async () => {
  const wav = await encodeWav([new Float32Array(48000).fill(0.2)], 48000).arrayBuffer();
  const bytes = new DataView(wav);
  assert.equal(new TextDecoder().decode(wav.slice(0,4)), 'RIFF');
  assert.equal(bytes.getUint32(24,true),16000);
  assert.equal(bytes.getUint32(40,true),32000);
  assert.equal(wav.byteLength,32044);
});

test('speech updates before stop and finalizes the latest snapshot', async t => {
  const env = environment(t);
  const service = new STTService();
  const interim = [], final = [];
  let ended = false;
  await service.startListening({ onInterimResult: text => interim.push(text), onFinalResult: text => final.push(text), onEnd: () => ended=true });
  env.feed();
  t.mock.timers.tick(1500); await setImmediate();
  assert.deepEqual(interim,['hola']);
  assert.equal(ended,false);
  assert.equal(env.stopped,0);
  assert.equal(service.getIsListening(),true);
  service.stopListening(); await setImmediate();
  assert.deepEqual(final,['hola']);
  assert.equal(ended,true);
  assert.ok(env.stopped > 0);
});

test('serializes snapshots and discards a response after cancellation', async t => {
  const env = environment(t);
  let resolve;
  const fetch = t.mock.method(globalThis,'fetch', () => new Promise(done => { resolve=done; }));
  const service = new STTService();
  const results=[];
  await service.startListening({ onInterimResult: text => results.push(text) });
  env.feed(); t.mock.timers.tick(1500); await setImmediate();
  env.feed(); t.mock.timers.tick(1500); await setImmediate();
  assert.equal(fetch.mock.callCount(),1);
  service.cancel();
  resolve(new Response(JSON.stringify({ transcript:'obsolete' })));
  await setImmediate();
  assert.deepEqual(results,[]);
  assert.ok(env.stopped > 0);
});

test('stop during an in-flight partial request still uploads the final audio', async t => {
  const env = environment(t);
  let resolve;
  const fetch = t.mock.method(globalThis,'fetch', () => new Promise(done => { resolve=done; }));
  const service = new STTService();
  const final=[];
  await service.startListening({ onFinalResult: text => final.push(text) });
  env.feed(); t.mock.timers.tick(1500); await setImmediate();
  service.stopListening();
  resolve(new Response(JSON.stringify({ transcript:'hola' })));
  await setImmediate();
  assert.equal(fetch.mock.callCount(),2);
  resolve(new Response(JSON.stringify({ transcript:'hola amigo' })));
  await setImmediate();
  assert.deepEqual(final,['hola amigo']);
});

test('auto narration plays once after one second and stop cancels pending playback', async t => {
  const { TTSService } = await import('./speechService.ts');
  t.mock.timers.enable({ apis:['setTimeout'] });
  const played=[];
  globalThis.Audio = class {
    constructor(src) { this.src=src; }
    play() { played.push(this.src); return Promise.resolve(); }
    pause() {}
    removeAttribute() {}
    load() {}
  };
  TTSService.schedule('Hola',1000);
  t.mock.timers.tick(999);
  assert.equal(played.length,0);
  t.mock.timers.tick(1);
  assert.equal(played.length,1);
  t.mock.timers.tick(5000);
  assert.equal(played.length,1);
  TTSService.schedule('Adiós',1000);
  TTSService.stop();
  t.mock.timers.tick(1000);
  assert.equal(played.length,1);
  TTSService.schedule('cancelled',1000);
  TTSService.speak('manual');
  t.mock.timers.tick(1000);
  assert.equal(played.length,2);
  assert.match(played[1],/manual/);
  TTSService.stop();
});

test('successful narration emits a recovery event and stale playback cannot clear errors', async t => {
  const { TTSService } = await import('./speechService.ts');
  const previousWindow = globalThis.window;
  const previousAudio = globalThis.Audio;
  const target = new EventTarget();
  globalThis.window = target;
  let audio;
  globalThis.Audio = class {
    constructor() { audio = this; }
    play() { return Promise.resolve(); }
    pause() {}
    removeAttribute() {}
    load() {}
  };
  t.after(() => { TTSService.stop(); globalThis.window = previousWindow; globalThis.Audio = previousAudio; });
  let starts = 0, ends = 0, events = 0;
  target.addEventListener('tts-start', () => events++);
  TTSService.speak('Hola', 1, () => starts++, () => ends++);
  const oldHandler = audio.onplaying;
  oldHandler();
  assert.equal(events, 1);
  assert.equal(starts, 1);
  TTSService.stop();
  oldHandler();
  assert.equal(events, 1);
  assert.equal(ends, 1);
});

test('autoplay blocking has a distinct message without blaming login expiry', async t => {
  const { TTSService } = await import('./speechService.ts');
  const previousWindow = globalThis.window;
  const previousAudio = globalThis.Audio;
  const target = new EventTarget();
  globalThis.window = target;
  globalThis.Audio = class {
    play() { const error = new Error('blocked'); error.name = 'NotAllowedError'; return Promise.reject(error); }
    pause() {}
    removeAttribute() {}
    load() {}
  };
  t.after(() => { TTSService.stop(); globalThis.window = previousWindow; globalThis.Audio = previousAudio; });
  const messages = [];
  target.addEventListener('tts-error', event => messages.push(event.detail));
  TTSService.speak('Hola');
  await setImmediate();
  assert.equal(messages.length, 1);
  assert.match(messages[0], /浏览器阻止了自动播放/);
  assert.doesNotMatch(messages[0], /登录/);
});
