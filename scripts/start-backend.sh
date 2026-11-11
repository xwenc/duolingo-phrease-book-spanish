#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -x backend/.venv/bin/python ]; then
  echo '请先创建 backend/.venv 并安装 backend/requirements.txt 中的依赖。' >&2
  exit 1
fi
exec backend/.venv/bin/python backend/dev.py "$@"
