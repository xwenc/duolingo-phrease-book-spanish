import io
import wave
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from speech import server


def wav(seconds):
    output = io.BytesIO()
    with wave.open(output, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(16000)
        f.writeframes(b'\0\0' * (16000 * seconds))
    return output.getvalue()


def test_decode_and_silence():
    assert len(server.decode_audio(wav(1))) == 16000
    server.models['stt'] = Mock()
    assert server.transcribe(wav(1)) == ''
    server.models['stt'].transcribe.assert_not_called()


def test_duration_limit():
    with pytest.raises(HTTPException) as error:
        server.decode_audio(wav(61))
    assert error.value.status_code == 413


def test_shared_inference_lock():
    server.lock.acquire()
    try:
        with pytest.raises(HTTPException) as error:
            server.synthesize(server.Synthesis(text='Hola'))
        assert error.value.status_code == 503
        with pytest.raises(HTTPException):
            server.transcribe(wav(1))
    finally:
        server.lock.release()


def test_ming_wav_and_speed_cache(monkeypatch):
    from types import SimpleNamespace
    import numpy as np
    model = Mock(sample_rate=44100)
    model.generate.return_value = [SimpleNamespace(audio=np.zeros(2400, dtype=np.float32))]
    monkeypatch.setitem(server.models, 'tts', model)
    server.cache.clear()
    body = server.Synthesis(text='Hola', speed=1)
    first = server.synthesize(body)
    second = server.synthesize(body)
    assert first.body == second.body
    with wave.open(io.BytesIO(first.body)) as audio:
        assert audio.getframerate() == 44100
        assert audio.getnframes() == 2400
    model.generate.assert_called_once_with('Hola', voice=server.VOICE, lang_code='es')
    server.synthesize(server.Synthesis(text='Hola', speed=0.6))
    assert model.generate.call_count == 1
    server.cache.clear()


def test_faster_whisper_segments_consumed_under_lock(monkeypatch):
    from types import SimpleNamespace
    import numpy as np
    def segments():
        assert server.lock.locked()
        yield SimpleNamespace(text=' Hola ')
        yield SimpleNamespace(text=' amigo ')
    model = Mock()
    model.transcribe.return_value = (segments(), None)
    monkeypatch.setitem(server.models, 'stt', model)
    audio = np.ones(16000, dtype=np.float32) * 0.1
    monkeypatch.setattr(server, 'decode_audio', lambda data: audio)
    assert server.transcribe(b'audio') == 'Hola amigo'
    assert not server.lock.locked()
    model.transcribe.assert_called_once_with(
        audio, language='es', vad_filter=True, condition_on_previous_text=False)


def test_speed_adjustment_preserves_pitch():
    import numpy as np
    rate = 24000
    waveform = np.sin(2 * np.pi * 440 * np.arange(rate) / rate).astype(np.float32)
    slow = server.change_speed(waveform, rate, 0.6)
    assert 1.5 < len(slow) / len(waveform) < 1.8
    frequency = np.argmax(np.abs(np.fft.rfft(slow))) * rate / len(slow)
    assert abs(frequency - 440) < 5
