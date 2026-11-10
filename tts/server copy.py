"""Local Piper worker. Internal Docker network only; public auth lives in API."""
import io
import os
import threading
import wave
from collections import OrderedDict
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

voice = None
lock = threading.Lock()
cache = OrderedDict()
cache_size = 0
CACHE_BYTES = 8 * 1024 * 1024

@asynccontextmanager
async def lifespan(app):
    global voice
    from piper import PiperVoice
    voice = PiperVoice.load(os.getenv('TTS_MODEL', '/voices/es_ES-davefx-medium.onnx'))
    yield

app = FastAPI(lifespan=lifespan)
class Synthesis(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    speed: float = Field(default=1, ge=0.5, le=1.2)

@app.get('/health')
def health():
    if voice is None:
        raise HTTPException(503, 'TTS model not loaded')
    return {'status': 'ok'}

@app.post('/synthesize')
def synthesize(body: Synthesis):
    global cache_size
    from piper import SynthesisConfig
    text = body.text.strip()
    if not text:
        raise HTTPException(422, 'Text must not be empty')
    if not lock.acquire(blocking=False):
        raise HTTPException(503, 'TTS busy', headers={'Retry-After': '2'})
    try:
        key = (text, body.speed)
        audio = cache.get(key)
        if audio is None:
            stream = io.BytesIO()
            with wave.open(stream, 'wb') as wav:
                voice.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1 / body.speed))
            audio = stream.getvalue()
            if len(audio) <= CACHE_BYTES:
                while cache and cache_size + len(audio) > CACHE_BYTES:
                    _, removed = cache.popitem(last=False)
                    cache_size -= len(removed)
                cache[key] = audio
                cache_size += len(audio)
        else:
            cache.move_to_end(key)
        return Response(audio, media_type='audio/wav')
    finally:
        lock.release()
