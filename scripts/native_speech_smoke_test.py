"""Run against the native worker without creating application accounts."""
import io
import time
import wave
import httpx

with httpx.Client(base_url='http://127.0.0.1:8001', timeout=600) as client:
    client.get('/health').raise_for_status()
    durations = {}
    for label, speed in [('normal', 1), ('slow', 0.6)]:
        start = time.monotonic()
        response = client.post('/synthesize', json={'text': 'Hola, buenos días. ¿Cómo estás?', 'speed': speed})
        response.raise_for_status()
        with wave.open(io.BytesIO(response.content)) as audio:
            assert audio.getframerate() == 44100
            durations[label] = audio.getnframes() / audio.getframerate()
        print(f'{label}: {durations[label]:.2f}s audio; {time.monotonic()-start:.2f}s generation')
        cached = client.post('/synthesize', json={'text': 'Hola, buenos días. ¿Cómo estás?', 'speed': speed})
        assert cached.content == response.content
        if label == 'normal':
            start = time.monotonic()
            result = client.post('/transcribe', files={'audio': ('sample.wav', response.content, 'audio/wav')})
            result.raise_for_status()
            assert result.json()['transcript'].strip()
            print(f'STT ({time.monotonic()-start:.2f}s): {result.json()["transcript"]}')
    assert durations['slow'] > durations['normal'] * 1.3
print('PASS native Ming 3.0 TTS 0.5B / faster-whisper / WAV / speed / cache')
