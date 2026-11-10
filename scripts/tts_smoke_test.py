"""Verify normal, slow and word audio from the real local Piper deployment."""
import io
import secrets
import wave
from uuid import uuid4
import httpx

with httpx.Client(base_url='http://localhost:3000', headers={'Origin':'http://localhost:3000'}, timeout=40) as client:
    response = client.post('/api/auth/register', json={
        'email':f'tts-smoke-{uuid4().hex}@example.invalid', 'password':secrets.token_urlsafe(24)})
    assert response.status_code == 200, response.text
    durations = {}
    for label, text, speed in [('normal','¡Hola! Mucho gusto en conocerte.',1),
                               ('slow','¡Hola! Mucho gusto en conocerte.',0.6),
                               ('word','conocerte',0.85)]:
        response = client.get('/api/tts', params={'text':text,'speed':speed})
        assert response.status_code == 200, (response.status_code, response.text[:200])
        assert response.headers['content-type'] == 'audio/wav'
        with wave.open(io.BytesIO(response.content)) as wav:
            duration = wav.getnframes() / wav.getframerate()
            assert wav.getframerate() == 22050
            assert duration > 0.1
        durations[label] = duration
        print(f'PASS {label}: {duration:.2f}s, {len(response.content)} bytes')
        cached = client.get('/api/tts', params={'text':text,'speed':speed})
        assert cached.content == response.content
    assert durations['slow'] > durations['normal'] * 1.3, durations
    assert durations['word'] < durations['normal'], durations
print('PASS: local normal/slow/word synthesis and cached audio')
