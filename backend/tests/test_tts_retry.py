import httpx
from unittest.mock import patch
from test_api import client, register


def test_busy_speech_retries_and_recovers_before_returning_audio(client):
    c, _ = client
    register(c)
    responses = [httpx.Response(503), httpx.Response(503), httpx.Response(200, content=b'RIFF-recovered', request=httpx.Request('POST', 'http://speech/synthesize'))]
    with patch('app.main.httpx.post', side_effect=responses) as request, patch('app.main.asyncio.sleep') as wait:
        result = c.get('/api/tts', params={'text': 'Hola'})
    assert result.status_code == 200
    assert result.content == b'RIFF-recovered'
    assert request.call_count == 3
    assert wait.call_count == 2
    assert all(call.args == (2,) for call in wait.call_args_list)


def test_busy_retry_is_bounded_and_auth_failure_does_not_trigger_it(client):
    c, _ = client
    with patch('app.main.httpx.post') as request:
        assert c.get('/api/tts', params={'text': 'Hola'}).status_code == 401
        request.assert_not_called()
    register(c)
    with patch('app.main.httpx.post', return_value=httpx.Response(503)) as request, patch('app.main.asyncio.sleep') as wait:
        result = c.get('/api/tts', params={'text': 'Hola'})
    assert result.status_code == 503
    assert result.headers['retry-after'] == '2'
    assert request.call_count == 4
    assert wait.call_count == 3



def test_cancelled_audio_request_does_not_keep_retrying(client):
    from unittest.mock import AsyncMock
    c, _ = client
    register(c)
    with patch('app.main.httpx.post', return_value=httpx.Response(503)) as request, patch('app.main.asyncio.sleep'), patch('app.main.Request.is_disconnected', new=AsyncMock(side_effect=[False, True])):
        result = c.get('/api/tts', params={'text': 'Hola'})
    assert result.status_code == 499
    assert request.call_count == 1
