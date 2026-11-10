import os
import threading
from io import BytesIO

class SpeechEngine:
    def __init__(self):
        self.model = None
        self.lock = threading.Lock()
    def load(self):
        from faster_whisper import WhisperModel
        self.model = WhisperModel(os.getenv('WHISPER_MODEL', '/models/small'), device='cpu', compute_type='int8', local_files_only=True)
    def transcribe(self, data):
        if not self.lock.acquire(blocking=False):
            from fastapi import HTTPException
            raise HTTPException(503, '语音引擎忙，请稍后重试', headers={'Retry-After': '5'})
        try:
            from faster_whisper.audio import decode_audio
            audio = decode_audio(BytesIO(data), sampling_rate=16000)
            if len(audio) > 16000 * 60:
                from fastapi import HTTPException
                raise HTTPException(413, '录音最长60秒')
            segments, _ = self.model.transcribe(audio, language='es', vad_filter=True, condition_on_previous_text=False)
            return ' '.join(s.text.strip() for s in segments).strip()
        finally:
            self.lock.release()
speech = SpeechEngine()
