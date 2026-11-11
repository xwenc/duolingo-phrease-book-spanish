"""HTTP bridge to the native macOS MLX worker; no model dependencies in Docker."""
import os
import httpx
from fastapi import HTTPException


def speech_url():
    return os.getenv('SPEECH_URL', 'http://127.0.0.1:8001').rstrip('/')


class SpeechEngine:
    def check(self):
        try:
            httpx.get(speech_url() + '/health', timeout=3).raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, '本地语音服务尚未就绪')

    def transcribe(self, data):
        try:
            result = httpx.post(speech_url() + '/transcribe',
                                files={'audio': ('recording', data, 'application/octet-stream')}, timeout=120)
            if result.status_code in (413, 422):
                raise HTTPException(result.status_code, result.json().get('detail', '无法解析录音'))
            result.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, '本地语音服务暂不可用或繁忙', headers={'Retry-After': '2'})
        return result.json()['transcript']


speech = SpeechEngine()
