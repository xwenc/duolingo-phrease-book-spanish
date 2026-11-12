"""Native Apple Silicon worker. Ming uses Metal; faster-whisper uses CPU int8."""
import io
import os
import platform
import threading
import unicodedata
from collections import OrderedDict
from contextlib import asynccontextmanager

import av
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

TTS_MODEL = os.getenv('TTS_MODEL', 'mlx-community/Ming-3.0-tts-0.5B-bf16')
STT_MODEL = os.getenv('STT_MODEL', 'small')
VOICE = os.getenv('TTS_VOICE') or None
lock = threading.Lock()
models = {}
cache = OrderedDict()
cache_lock = threading.Lock()
CACHE_BYTES = 8 * 1024 * 1024


def load():
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise RuntimeError('Native macOS Apple Silicon is required; do not run this worker in Docker')
    from mlx_audio.tts.utils import load_model as load_tts
    from faster_whisper import WhisperModel
    models['tts'] = load_tts(TTS_MODEL)
    models['stt'] = WhisperModel(STT_MODEL, device='cpu', compute_type='int8',
                                 download_root=os.path.join(os.getenv('HF_HOME', '.local-test/huggingface'), 'faster-whisper'))


@asynccontextmanager
async def lifespan(app):
    await run_in_threadpool(load)
    yield


app = FastAPI(lifespan=lifespan)


@app.get('/health')
def health():
    if len(models) != 2:
        raise HTTPException(503, 'Speech models not loaded')
    return {'status': 'ok', 'tts': TTS_MODEL, 'stt': STT_MODEL}


class Synthesis(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    speed: float = Field(default=1, ge=0.5, le=1.2)


@app.post('/synthesize')
def synthesize(body: Synthesis):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, 'Text must not be empty')
    key = (text, body.speed)
    # Cached WAVs need no model inference and must not contend with STT.
    audio = cached_audio(key)
    if audio is not None:
        return Response(audio, media_type='audio/wav')
    if not lock.acquire(blocking=False):
        raise HTTPException(503, 'Speech engine busy', headers={'Retry-After': '2'})
    try:
        audio = cached_audio(key)
        if audio is None:
            base_key = (text, 1.0)
            audio = cached_audio(base_key)
            if audio is None:
                chunks = [waveform_array(r.audio) for r in models['tts'].generate(
                    text, voice=VOICE, lang_code='es')]
                if not chunks:
                    raise HTTPException(422, 'No audio generated')
                output = io.BytesIO()
                sf.write(output, np.concatenate(chunks), models['tts'].sample_rate,
                         format='WAV', subtype='PCM_16')
                audio = output.getvalue()
                cache_audio(base_key, audio)
            if body.speed != 1:
                waveform, rate = sf.read(io.BytesIO(audio), dtype='float32')
                output = io.BytesIO()
                sf.write(output, change_speed(waveform, rate, body.speed), rate,
                         format='WAV', subtype='PCM_16')
                audio = output.getvalue()
                cache_audio(key, audio)
        return Response(audio, media_type='audio/wav')
    finally:
        lock.release()


def waveform_array(audio):
    # NumPy cannot read MLX bfloat16 buffers; cast only audio, not model weights.
    if type(audio).__module__.startswith('mlx'):
        import mlx.core as mx
        audio = audio.astype(mx.float32)
    return np.asarray(audio, dtype=np.float32).reshape(-1)


def cached_audio(key):
    with cache_lock:
        audio = cache.get(key)
        if audio is not None:
            cache.move_to_end(key)
        return audio


def cache_audio(key, audio):
    with cache_lock:
        if len(audio) <= CACHE_BYTES:
            while cache and sum(map(len, cache.values())) + len(audio) > CACHE_BYTES:
                cache.popitem(last=False)
            cache[key] = audio


def change_speed(waveform, rate, speed):
    """FFmpeg atempo via PyAV: change duration while preserving voice pitch."""
    frame = av.AudioFrame.from_ndarray(waveform.reshape(1, -1), format='fltp', layout='mono')
    frame.sample_rate = rate
    graph = av.filter.Graph()
    source = graph.add_abuffer(sample_rate=rate, format='fltp', layout='mono')
    tempo = graph.add('atempo', str(speed))
    sink = graph.add('abuffersink')
    graph.link_nodes(source, tempo, sink)
    graph.configure()
    source.push(frame)
    source.push(None)
    chunks = []
    while True:
        try:
            chunks.append(sink.pull().to_ndarray().reshape(-1))
        except (av.error.EOFError, av.error.BlockingIOError):
            break
    if not chunks:
        raise HTTPException(422, 'No audio after speed adjustment')
    return np.concatenate(chunks)


def decode_audio(data):
    """Decode incrementally, rejecting long recordings before allocating unbounded PCM."""
    chunks = []
    count = 0
    with av.open(io.BytesIO(data)) as container:
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=16000)
        for frame in container.decode(audio=0):
            for part in resampler.resample(frame):
                count += part.samples
                if count > 16000 * 60:
                    raise HTTPException(413, '录音最长60秒')
                chunks.append(part.to_ndarray().reshape(-1))
        for part in resampler.resample(None):
            count += part.samples
            if count > 16000 * 60:
                raise HTTPException(413, '录音最长60秒')
            chunks.append(part.to_ndarray().reshape(-1))
    if not count:
        raise ValueError('Empty audio')
    return np.concatenate(chunks)


def transcribe(data):
    if not lock.acquire(blocking=False):
        raise HTTPException(503, 'Speech engine busy', headers={'Retry-After': '2'})
    try:
        audio = decode_audio(data)
        # Avoid Whisper hallucinations for silent snapshots during live recording.
        if np.max(np.abs(audio)) < 0.001:
            return ''
        segments, _ = models['stt'].transcribe(
            audio, language='es', vad_filter=True, condition_on_previous_text=False)
        # Consume the lazy generator while holding the inference lock.
        return unicodedata.normalize('NFC', ' '.join(segment.text.strip() for segment in segments).strip())
    finally:
        lock.release()


@app.post('/transcribe')
async def transcription(audio: UploadFile):
    data = await audio.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, '录音超过8MB')
    try:
        return {'transcript': await run_in_threadpool(transcribe, data)}
    except HTTPException:
        raise
    except (ValueError, av.error.FFmpegError):
        raise HTTPException(422, '无法解析录音，请重新录制')
