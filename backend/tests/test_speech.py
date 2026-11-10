"""Import the real engine dependencies; API tests alone use a substitute."""
def test_engine_dependencies_import():
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    assert callable(WhisperModel)
    assert callable(decode_audio)

def test_real_audio_decoder_compatibility():
    import io
    import wave
    from faster_whisper.audio import decode_audio
    audio = io.BytesIO()
    with wave.open(audio, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b'\0\0' * 16000)
    audio.seek(0)
    assert len(decode_audio(audio, sampling_rate=16000)) == 16000
