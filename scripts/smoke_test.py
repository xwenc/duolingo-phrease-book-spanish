"""Run against the local Compose deployment. Creates a unique test account.
Usage: python scripts/smoke_test.py [--audio /path/to/spanish.wav]
Requires httpx (included in backend/requirements.txt).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import secrets
from uuid import uuid4
import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
parser.add_argument('--audio')
parser.add_argument('--restart', action='store_true', help='Restart local containers and verify persistence')
args = parser.parse_args()
client = httpx.Client(base_url=args.base_url, headers={'Origin': args.base_url}, timeout=120)

def checked(response, expected=200):
    assert response.status_code == expected, (response.status_code, response.text[:500])
    return response.json()

checked(client.get('/api/me'), 401)
checked(client.get('/api/health'))
assert client.get('/').status_code == 200
email = f'smoke-{uuid4().hex}@example.invalid'
password = secrets.token_urlsafe(24)
checked(client.post('/api/auth/register', json={'email':email, 'password':password}))
exercises = checked(client.get('/api/exercises'))
assert exercises
exercise = exercises[0]
checked(client.put(f"/api/stars/{exercise['id']}?enabled=true"))
assert exercise['id'] in checked(client.get('/api/me'))['starredIds']
body = {'requestId': str(uuid4()), 'exerciseId': exercise['id'], 'transcript':exercise['spanish']}
# All requests share the session, as concurrent browser tabs would.
with ThreadPoolExecutor(max_workers=6) as pool:
    replies = list(pool.map(lambda _: client.post('/api/attempts', json=body), range(6)))
assert all(r.status_code == 200 for r in replies), [(r.status_code, r.text[:120]) for r in replies]
assert checked(client.get('/api/me'))['xp'] == 15
body['requestId'] = str(uuid4())
checked(client.post('/api/attempts', json=body))
assert checked(client.get('/api/me'))['xp'] == 15
# Distinct requests for one newly passed exercise award only once.
second = exercises[1]
with ThreadPoolExecutor(max_workers=6) as pool:
    replies = list(pool.map(lambda _: client.post('/api/attempts', json={
        'requestId': str(uuid4()), 'exerciseId':second['id'], 'transcript':second['spanish']
    }), range(6)))
assert all(r.status_code == 200 for r in replies), [(r.status_code, r.text[:120]) for r in replies]
assert checked(client.get('/api/me'))['xp'] == 30
failed = {'requestId':str(uuid4()), 'exerciseId':exercise['id'], 'transcript':''}
with ThreadPoolExecutor(max_workers=6) as pool:
    replies = list(pool.map(lambda _: client.post('/api/attempts', json=failed), range(6)))
assert all(r.status_code == 200 for r in replies)
assert checked(client.get('/api/me'))['hearts'] == 4
checked(client.post('/api/logout'))
checked(client.get('/api/me'), 401)
checked(client.post('/api/auth/login', json={'email':email, 'password':password}))
assert exercise['id'] in checked(client.get('/api/me'))['starredIds']
print('PASS: real MySQL auth, exercises, favorites, concurrent idempotency, rewards and login persistence')
if args.audio:
    from pathlib import Path
    audio_path = Path(args.audio)
    mime = {'.wav':'audio/wav', '.mp4':'audio/mp4', '.webm':'audio/webm', '.ogg':'audio/ogg'}[audio_path.suffix]
    with audio_path.open('rb') as audio:
        result = checked(client.post('/api/speech', files={'audio': (audio_path.name, audio, mime)}))
    assert result['transcript'].strip()
    print('Whisper transcript:', result['transcript'])
    spoken = checked(client.post('/api/attempts', json={'requestId':str(uuid4()), 'exerciseId':exercise['id'], 'transcript':result['transcript']}))
    print('Real audio score:', spoken['evaluation']['score'])
    # This verifies the real transport/inference/scoring path, not model accuracy.
    assert spoken['evaluation']['rawSpoken'] == result['transcript']
    assert 0 <= spoken['evaluation']['score'] <= 100
    assert spoken['evaluation']['isPassed'] == (spoken['evaluation']['score'] >= 75)
if args.restart:
    import subprocess
    import time
    before = checked(client.get('/api/me'))
    subprocess.run(['docker', 'compose', 'restart', 'mysql', 'api', 'web'], check=True)
    for retry in range(60):
        try:
            if client.get('/api/health').status_code == 200:
                break
        except httpx.TransportError:
            pass
        time.sleep(0.5)
    assert checked(client.get('/api/me')) == before
    print('PASS: session and account state survive MySQL/API/web restart')
print('Smoke account:', email)
client.close()
