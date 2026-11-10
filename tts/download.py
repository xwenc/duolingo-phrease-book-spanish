"""One-time model download; runtime synthesis is fully offline."""
from pathlib import Path
import shutil
import urllib.request

root = Path('/voices')
root.mkdir(parents=True, exist_ok=True)
base = 'https://huggingface.co/rhasspy/piper-voices/resolve/cf910fb59f1d79ab3b625a63993a108751c6c25d/es/es_ES/davefx/medium/'
for name in ('es_ES-davefx-medium.onnx', 'es_ES-davefx-medium.onnx.json', 'MODEL_CARD'):
    target = root / name
    if target.exists() and target.stat().st_size > 0:
        continue
    temp = target.with_name(name + '.partial')
    print('Downloading', name, flush=True)
    with urllib.request.urlopen(base + name, timeout=120) as response, temp.open('wb') as out:
        shutil.copyfileobj(response, out)
    temp.replace(target)
    target.chmod(0o644)
print('Spanish TTS voice ready', flush=True)
