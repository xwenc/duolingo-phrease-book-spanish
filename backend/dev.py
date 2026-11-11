"""Local backend entry point. Load development settings before importing app modules."""
import argparse
import os
from pathlib import Path
import sys
import subprocess
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR.parent / '.env.development.local'


def load_development_env(path=ENV_FILE):
    path = Path(path)
    if not path.is_file():
        raise ValueError('缺少 .env.development.local，请从 .env.development.local.example 复制后填写。')
    # Shell/CI overrides take priority. Never read Compose's .env implicitly.
    load_dotenv(path, override=False, interpolate=False)
    if not os.getenv('DATABASE_URL', '').strip():
        raise ValueError('请在 .env.development.local 中配置 DATABASE_URL。')


def main():
    parser = argparse.ArgumentParser(description='使用 .env.development.local 启动本地后端')
    parser.add_argument('command', nargs='?', default='serve', choices=['serve', 'migrate', 'seed'])
    parser.add_argument('--file', help='seed 使用的书籍导出 JSON 文件')
    args = parser.parse_args()
    if args.file and args.command != 'seed':
        parser.error('--file 仅用于 seed 命令')
    seed_file = str(Path(args.file).expanduser().resolve()) if args.file else None
    try:
        load_development_env()
    except ValueError as error:
        parser.exit(1, f'{error}\n')
    os.chdir(BACKEND_DIR)
    if args.command == 'migrate':
        command = ['-m', 'alembic', 'upgrade', 'head']
    elif args.command == 'seed':
        command = ['-m', 'app.seed']
        if seed_file:
            command += ['--file', seed_file]
    else:
        print('正在检查并升级开发数据库…', flush=True)
        try:
            subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND_DIR, check=True)
        except subprocess.CalledProcessError:
            parser.exit(1, '数据库迁移失败，后端未启动；请检查开发数据库配置及迁移日志。\n')
        command = ['-m', 'uvicorn', 'app.main:app', '--host', os.getenv('BACKEND_HOST', '127.0.0.1'), '--port', os.getenv('BACKEND_PORT', '8000'), '--reload', '--reload-dir', str(BACKEND_DIR)]
    os.execv(sys.executable, [sys.executable, *command])


if __name__ == '__main__':
    main()
