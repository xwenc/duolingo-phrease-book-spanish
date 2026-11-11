from unittest.mock import patch
import httpx
import pytest
from fastapi import HTTPException
from app.speech import SpeechEngine


def test_native_worker_transcription():
    response = httpx.Response(200, json={'transcript': 'Hola amigo'},
                              request=httpx.Request('POST', 'http://localhost/transcribe'))
    with patch('app.speech.httpx.post', return_value=response) as post:
        assert SpeechEngine().transcribe(b'wave') == 'Hola amigo'
        assert post.call_args.kwargs['files']['audio'][1] == b'wave'


@pytest.mark.parametrize('status', [413, 422, 503])
def test_worker_errors_preserved(status):
    response = httpx.Response(status, json={'detail': 'audio error'},
                             request=httpx.Request('POST', 'http://localhost/transcribe'))
    with patch('app.speech.httpx.post', return_value=response):
        with pytest.raises(HTTPException) as error:
            SpeechEngine().transcribe(b'wave')
        assert error.value.status_code == status


def test_worker_outage_and_recovery():
    with patch('app.speech.httpx.get', side_effect=httpx.ConnectError('offline')):
        with pytest.raises(HTTPException) as error:
            SpeechEngine().check()
        assert error.value.status_code == 503
    with patch('app.speech.httpx.get', return_value=httpx.Response(200, request=httpx.Request('GET', 'http://localhost/health'))):
        SpeechEngine().check()
