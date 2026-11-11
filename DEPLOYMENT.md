# 服务端重构与部署

本分支使用 React + FastAPI + MySQL 8.4 + 宿主机原生语音服务（mlx-audio / Ming 3.0 TTS 0.5B + faster-whisper STT）。用户、收藏、答题记录及积分保存在 MySQL；浏览器只保留音效偏好，不再以 localStorage 作为账户数据源。示例种子文件 `backend/app/book.json` 使用后台书籍导出格式，运行时教材从 API 获取。

## Apple Silicon 本地启动

需要原生 arm64 macOS、Python 3.12、uv 和 Docker Desktop。模型运行在宿主机，MySQL / API / web 仍使用 Compose。

```sh
cp .env.example .env
# 设置两组数据库密码；本地 HTTP 使用 COOKIE_SECURE=false
uv venv --python 3.12 speech/.venv
uv pip install --python speech/.venv/bin/python -r speech/requirements.txt
./scripts/start-speech.sh
```

首次启动从 Hugging Face 下载 Ming 3.0 TTS 0.5B 和 faster-whisper small，缓存在 `.local-test/huggingface`。保持该终端运行，另开终端：

```sh
curl --fail http://127.0.0.1:8001/health
docker compose up -d mysql
docker compose --profile setup run --build --rm init
docker compose up -d --build --remove-orphans api web
```

访问 http://localhost:3000。API 通过 `http://host.docker.internal:8001` 访问原生服务；本机直接运行 API 时默认使用 `http://127.0.0.1:8001`。可用 `SPEECH_URL` 覆盖。Docker Desktop 应能访问宿主机回环端口；若当前网络模式不支持，可设置 `SPEECH_HOST=0.0.0.0` 启动并用防火墙限制到 Docker 网络。原生服务无用户鉴权，不应暴露到公网。

`TTS_MODEL` 默认 `mlx-community/Ming-3.0-tts-0.5B-bf16`，`TTS_VOICE` 默认留空（模型默认音色），可设为 Ming 内置音色如 `UK_Charlotte`，TTS 使用 `lang_code=es`；`STT_MODEL` 默认 `small`，使用 faster-whisper / CTranslate2 的 CPU int8 推理，固定西语转写并启用 VAD。可通过启动脚本的环境变量使用其他兼容模型或本地路径。不要增加 worker：模型常驻内存，TTS/STT 共用推理锁，繁忙返回503。实际速度和内存占用取决于 Mac 型号，尚不提供加速倍数保证。

模型缓存保存在宿主机；Compose 仅保留 MySQL 数据卷。勿运行 `down -v`，以免删除数据库。

## 规则与接口

- `POST /api/auth/register`、`POST /api/auth/login`：邮箱、Argon2密码哈希及7天随机会话。会话令牌以 SHA-256 摘要存储，Cookie 为 HttpOnly / SameSite=Lax。
- `POST /api/logout`、`GET /api/me`：注销当前会话、读取账户状态。
- `GET /api/exercises`：已登录题库列表；`PUT /api/stars/{id}?enabled=true|false`：收藏。
- `POST /api/speech`：multipart `audio`，支持 WebM / MP4 / Ogg / WAV。限制8MB、60秒；浏览器录音55秒自动结束。AudioWorklet 连续采集声音，每约1.5秒将最新PCM音频快照编码为完整16kHz WAV上传，录音中就更新文字，结束时再补全最终结果。音频只在内存中解码与处理，不写入业务持久化存储。
- `POST /api/attempts`：`requestId`（UUID）、`exerciseId`、`transcript`。服务端根据数据库中的标准句评分；相同请求重试不重复扣红心或发奖励。每道题首次通过奖励15经验及2宝石，后续通过不再奖励，未通过扣1红心。账户行锁保证同一账户并发更新串行执行。
- `POST /api/hearts/refill`：10宝石补满；距上次练习30分钟后免费补满，避免新用户因红心耗尽无法继续。
- 连胜按服务端 UTC 日期计算，同一天多次练习不增加天数。当前记录任何有效提交的练习日，包含跳过。
- `GET /api/health`：检查数据库及模型就绪。

评分为转写文本的逐词对齐及完整度评分，保留 `ñ` 与 `n` 区别，忽略元音重音与标点，额外词也计入分母，75分通过。它不是经过验证的音素准确度、韵律或口音测评。转写使用 faster-whisper（CPU int8，启用 VAD），静音快照跳过推理。示范朗读由本地 Ming 3.0 TTS 0.5B 生成 WAV；浏览器只负责录音与播放，不再使用 SpeechSynthesis 或 Web Speech Recognition。

## 本地开发与测试

```sh
npm ci
npm run dev
# Vite 将 /api 代理到本机8000端口

python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cp .env.development.local.example .env.development.local
# 编辑 .env.development.local，填写本地数据库和管理员凭据。
npm run dev:backend:migrate  # 单独执行迁移（启动命令也会自动执行）
# npm run dev:backend:seed   # 可选：首次需要示例题库时手动执行
npm run dev:backend
```

开发启动、迁移和 seed 自动读取项目根目录 `.env.development.local`；已有进程环境变量优先，修改配置后需重启后端。该文件被 Git 忽略，Docker 部署仍使用 `.env`。

本地开发需另行提供本地 MySQL；Compose 默认不暴露数据库端口。不要为方便开发而把数据库开放到公网。

```sh
npm run lint
npm run build
cd backend
.venv/bin/python -m pytest tests -q
```

接口测试使用内存 SQLite 和替身转写引擎验证鉴权、收藏隔离、评分、重复提交、奖励上限、红心和上传格式。SQLite 测试不能验证 MySQL 行锁语义，替身不能验证真实模型转写质量。另需在 MySQL、真实模型及目标 iOS Safari 上验收录音授权、MP4上传、转写准确率和并发性能。

## 数据变更与升级

Alembic 管理数据库结构，初始迁移在 `backend/migrations/versions/0001_initial.py`。升级已有环境先备份数据库，再运行 `docker compose --profile setup run --build --rm init`，最后重新部署 API / web。种子导入使用 `backend/app/book.json` 的 `habla-espanol-book` 版本 1 格式，与后台导入共用校验；按 ID 幂等同步书籍、章节、句子，不删除额外内容、账户或练习记录，保留已有封面。开发环境可运行 `npm run dev:backend:seed -- --file ./path/to/book.json` 指定其他导出文件。未来数据库变更必须新增迁移文件；运行时不会自动 `create_all` 或覆盖数据。

原演示 localStorage 里的积分与收藏没有可信来源，不自动导入账户。已有用户需注册新账户。

## 公网发布前

本仓库提供可部署的服务端实现，不代表已通过商业上线验收：

1. 在外层配置域名与 HTTPS，设置 `APP_ORIGIN=https://实际域名` 和 `COOKIE_SECURE=true`。手机浏览器远程录音需要 HTTPS。修改 Cookie 设置后重新登录。
2. Nginx 已对认证及录音请求按 IP 限流，API 不可绕过代理直接暴露。使用 CDN / 负载均衡器时，应只信任已知代理并正确配置真实客户端 IP，否则会共用限流额度。
3. 按业务补充邮箱验证、密码找回、账户删除、隐私告知及适用的数据保留期限。当前答题转写保存在 attempts，需制定清理策略；过期 sessions 需定期清理。当前已有管理员教材编辑、导入与导出 UI，尚无付款或订阅功能。
4. 配置数据库定期备份并演练恢复，监控错误率、延迟、模型繁忙率、磁盘与内存，测试真实 MySQL 并发及真实录音。不在日志中打印密码、Cookie或音频。
5. 当前模型可拒绝繁忙请求，没有持久队列或跨实例调度。流量增长后引入独立推理工作进程、队列及共享限流；不要直接增加 Uvicorn worker 导致重复加载模型。TTS 在原生 macOS 进程中使用 MLX / Metal，STT 使用 faster-whisper CPU int8。

## 语音服务验证

```sh
uv pip install --python speech/.venv/bin/python -r speech/requirements-dev.txt
speech/.venv/bin/python -m pytest speech/tests -q
PYTHONPATH=backend speech/.venv/bin/python -m pytest backend/tests -q
speech/.venv/bin/python scripts/native_speech_smoke_test.py
speech/.venv/bin/python scripts/tts_smoke_test.py
speech/.venv/bin/python scripts/smoke_test.py --audio /absolute/path/to/spanish.wav
```

前两项使用替身模型验证桥接、错误处理、真实音频解码、时长限制和并发锁；native_speech_smoke_test 仅要求原生服务启动；后两项要求原生模型及 Compose 均已启动，会创建测试账户。Ming 3.0 TTS 0.5B 输出44.1kHz PCM WAV，慢速通过 PyAV atempo 保留音高变速，复用原速合成结果，缓存最多8MB。模型和音色说明见 [speech/THIRD_PARTY.md](speech/THIRD_PARTY.md)。

Ming bf16 模型文件约3GB，运行时还需要额外统一内存。默认使用模型音色；可通过启动环境变量 `TTS_VOICE=UK_Charlotte` 指定内置音色，语言始终使用 `es`。数值 `speed` 在模型接口中被忽略，因此工作进程用 PyAV atempo 保留音高变速，并复用原速合成缓存。API 的 TTS 等待上限为600秒，Nginx 为610秒。模型采用 [MIT 许可](https://huggingface.co/mlx-community/Ming-3.0-tts-0.5B-bf16)。

## Ming TTS 验证记录（2026-11-10）

当前 TTS 为 `mlx-community/Ming-3.0-tts-0.5B-bf16`，使用 mlx-audio 0.6.5 原生 Metal 推理，固定语言 `es`，默认不指定音色。约3GB模型文件已下载并完成大权重 SHA-256 校验。STT 使用 faster-whisper `small` CPU int8。

22 项后端/语音测试通过。真实 Ming 合成 `Hola, buenos días. ¿Cómo estás?` 得到1.90秒、44.1kHz音频，首次请求耗时3.61秒；faster-whisper 转写结果为 `Hola, buenos días. ¿Cómo estás?`，单次耗时1.32秒。0.6倍速复用原速缓存并保留音高，得到3.14秒音频，处理耗时约0.01秒。以上为单次观察，不是性能基准。

认证后的应用接口通过正常/慢速/单词朗读及缓存验证，MySQL 登录、收藏、并发幂等、奖励和真实 STT 链路通过。冒烟测试创建了独立测试账户。

开发启动命令 `npm run dev:backend` 会先执行 `alembic upgrade head`，迁移成功后再启动 API 和初始化管理员；迁移失败则停止启动。不会自动运行 seed，因此重复启动不会覆盖后台编辑的教材。空数据库启动后可直接登录后台添加教材。
