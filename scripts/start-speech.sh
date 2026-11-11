#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Keep all downloaded weights inside this checkout; no Docker model volumes.
export HF_HOME="${HF_HOME:-$PWD/.local-test/huggingface}"
export TOKENIZERS_PARALLELISM=false
export HF_HUB_DISABLE_XET="${HF_HUB_DISABLE_XET:-1}"
exec speech/.venv/bin/python -m uvicorn speech.server:app \
  --host "${SPEECH_HOST:-127.0.0.1}" --port "${SPEECH_PORT:-8001}" --workers 1
