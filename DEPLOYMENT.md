# 服务端重构与部署

本分支使用 React + FastAPI + MySQL 8.4 + 本地 faster-whisper。用户、收藏、答题记录及积分保存在 MySQL；浏览器只保留音效偏好，不再以 localStorage 作为账户数据源。原静态题库只用于版本化种子导出，运行时从 API 获取。

## Docker 本地启动

需要 Docker Compose v2。首次构建与下载模型需要联网，推理时不联网、不向第三方上传录音。

```sh
cp .env.example .env
# 编辑 .env：设置两组不同的随机十六进制密码
# 本地 HTTP 保持 COOKIE_SECURE=false；公网部署必须改为 true

docker compose up -d mysql
docker compose --profile setup run --build --rm model-download
docker compose --profile setup run --build --rm tts-model-download
docker compose --profile setup run --build --rm init
docker compose up -d --build api tts web
```

访问 http://localhost:3000，注册账号（密码至少12位）。模型服务必须成功加载、数据库健康检查通过后，web 才会启动。容器默认单个 CPU int8 推理进程，同一时刻接受一个转写任务，繁忙返回503。内存和耗时需要在目标机器上压测；建议先准备至少4GB可用内存。

MySQL 不暴露主机端口；API 仅在 Docker 网络内可达。前端通过 Nginx 同源代理 `/api`，没有把数据库密码写入前端。数据库和模型使用独立持久化卷；`docker compose down` 保留数据，勿使用 `down -v`，除非有意删除所有数据。

## 规则与接口

- `POST /api/auth/register`、`POST /api/auth/login`：邮箱、Argon2密码哈希及7天随机会话。会话令牌以 SHA-256 摘要存储，Cookie 为 HttpOnly / SameSite=Lax。
- `POST /api/logout`、`GET /api/me`：注销当前会话、读取账户状态。
- `GET /api/exercises`：已登录题库列表；`PUT /api/stars/{id}?enabled=true|false`：收藏。
- `POST /api/speech`：multipart `audio`，支持 WebM / MP4 / Ogg / WAV。限制8MB、60秒；浏览器录音55秒自动结束。AudioWorklet 连续采集声音，每约1.5秒将最新PCM音频快照编码为完整16kHz WAV上传，录音中就更新文字，结束时再补全最终结果。音频只在内存中解码与处理，不写入业务持久化存储。
- `POST /api/attempts`：`requestId`（UUID）、`exerciseId`、`transcript`。服务端根据数据库中的标准句评分；相同请求重试不重复扣红心或发奖励。每道题首次通过奖励15经验及2宝石，后续通过不再奖励，未通过扣1红心。账户行锁保证同一账户并发更新串行执行。
- `POST /api/hearts/refill`：10宝石补满；距上次练习30分钟后免费补满，避免新用户因红心耗尽无法继续。
- 连胜按服务端 UTC 日期计算，同一天多次练习不增加天数。当前记录任何有效提交的练习日，包含跳过。
- `GET /api/health`：检查数据库及模型就绪。

评分为转写文本的逐词对齐及完整度评分，保留 `ñ` 与 `n` 区别，忽略元音重音与标点，额外词也计入分母，75分通过。它不是经过验证的音素准确度、韵律或口音测评。转写能力及 VAD 使用方式参考 [faster-whisper 官方文档](https://github.com/SYSTRAN/faster-whisper)。示范朗读由本地 Piper TTS 生成 WAV；浏览器只负责录音与播放，不再使用 SpeechSynthesis 或 Web Speech Recognition。

## 本地开发与测试

```sh
npm ci
npm run dev
# Vite 将 /api 代理到本机8000端口

python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
export DATABASE_URL='mysql+pymysql://spanish:YOUR_PASSWORD@127.0.0.1:3306/spanish?charset=utf8mb4'
export APP_ORIGIN='http://localhost:3000'
export COOKIE_SECURE=false
export WHISPER_MODEL='/absolute/path/to/downloaded/small'
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

本地开发需另行提供本地 MySQL；Compose 默认不暴露数据库端口。不要为方便开发而把数据库开放到公网。

```sh
npm run lint
npm run build
cd backend
.venv/bin/python -m pytest tests -q
```

接口测试使用内存 SQLite 和替身转写引擎验证鉴权、收藏隔离、评分、重复提交、奖励上限、红心和上传格式。SQLite 测试不能验证 MySQL 行锁语义，替身不能验证真实模型转写质量。另需在 MySQL、真实模型及目标 iOS Safari 上验收录音授权、MP4上传、转写准确率和并发性能。

## 数据变更与升级

Alembic 管理数据库结构，初始迁移在 `backend/migrations/versions/0001_initial.py`。升级已有环境先备份数据库，再运行 `docker compose --profile setup run --build --rm init`，最后重新部署 API / web。种子导入幂等：插入缺失题目，并按相同ID更新为当前 exercises.json 的内容；普通 seed 不删除额外题目或练习记录。未来数据库变更必须新增迁移文件；运行时不会自动 `create_all` 或覆盖数据。

原演示 localStorage 里的积分与收藏没有可信来源，不自动导入账户。已有用户需注册新账户。

## 公网发布前

本仓库提供可部署的服务端实现，不代表已通过商业上线验收：

1. 在外层配置域名与 HTTPS，设置 `APP_ORIGIN=https://实际域名` 和 `COOKIE_SECURE=true`。手机浏览器远程录音需要 HTTPS。修改 Cookie 设置后重新登录。
2. Nginx 已对认证及录音请求按 IP 限流，API 不可绕过代理直接暴露。使用 CDN / 负载均衡器时，应只信任已知代理并正确配置真实客户端 IP，否则会共用限流额度。
3. 按业务补充邮箱验证、密码找回、账户删除、隐私告知及适用的数据保留期限。当前答题转写保存在 attempts，需制定清理策略；过期 sessions 需定期清理。没有付款、订阅、后台管理或题库编辑 UI。
4. 配置数据库定期备份并演练恢复，监控错误率、延迟、模型繁忙率、磁盘与内存，测试真实 MySQL 并发及真实录音。不在日志中打印密码、Cookie或音频。
5. 当前模型可拒绝繁忙请求，没有持久队列或跨实例调度。流量增长后引入独立推理工作进程、队列及共享限流；不要直接增加 Uvicorn worker 导致重复加载模型。GPU 需单独配置 CUDA / CTranslate2 兼容镜像，本配置为 CPU。

## Docker 联调记录（2026-11-10）

已在本机 ARM64 Docker 环境完成：

- 前后端镜像构建、MySQL 8.4 迁移与重复题库初始化。
- 注册、登录、注销、题库读取、收藏持久化及同源 Nginx 代理。
- 六个并发相同请求仅记一次答题；六个不同请求首次通过同一题仅奖励一次；失败请求重试仅扣一次红心。
- 本地 small 模型 CPU int8 真实音频转写与评分；重启 MySQL / API / web 后，会话与账户状态保持。
- 8 项后端测试，包含真实音频解码兼容性检查。

联调修复了 MySQL 默认 REPEATABLE READ 导致幂等查询使用旧快照的问题；MySQL 连接现在使用 READ COMMITTED，并保留账户行锁。另固定 `av==18.1.0`，避免 PyAV 19 删除 `metadata_errors` 参数导致转写失败，参见 [faster-whisper 上游问题](https://github.com/SYSTRAN/faster-whisper/issues/1589)。

本次西班牙语合成 WAV 样本中，`conocerte` 被识别为 `como hacerte`，完整度得分67。该测试证明实际链路可运行，不代表识别准确率已达标。iOS 真机录音、真人语料准确率、生产负载及公网 HTTPS 仍需单独验收。

可复现测试（在项目根目录执行）：

```sh
backend/.venv/bin/python scripts/smoke_test.py
backend/.venv/bin/python scripts/smoke_test.py --audio /absolute/path/to/spanish.wav
# 以下选项会重启本地三个服务，验证数据与会话持久化
backend/.venv/bin/python scripts/smoke_test.py --audio /absolute/path/to/spanish.wav --restart
```

脚本会创建独立 `smoke-…@example.invalid` 测试账户；不会输出密码。音频评分测试使用第一道题的标准句，请准备相应录音。测试检查评分结果与通过阈值一致，不强制模型必须识别为满分。


## 本地示范朗读（Piper TTS）

正常、乌龟慢速、词汇提示、逐词比对和收藏列表的朗读统一调用 `GET /api/tts?text=...&speed=...`。该接口要求登录，限制文本500字符、语速0.5至1.2；FastAPI 将请求发送到 Docker 内部的独立 `tts` 服务。Piper 1.8.0 使用 `es_ES-davefx-medium` 西班牙音色，输出22,050Hz WAV。慢速通过合成时的 `length_scale` 调整，不依赖浏览器变速或系统音色。

`tts` 无主机映射端口，模型以只读卷挂载，单进程合成、繁忙返回503，并提供8MB有界内存音频缓存；Nginx 对朗读接口单独限流。浏览器直接播放同源 `/api/tts` 地址，保留用户点击触发的播放授权。切换题目、退出登录、开始录音或播放另一段时停止前一段，失败会显示页面错误。每个服务实例分别缓存；运行时不访问外部TTS服务。开发模式下若单独在主机运行API，需要另行提供可达的本地Piper地址并设置 `TTS_URL`；完整功能推荐使用Compose。

新增服务升级步骤（已有MySQL及Whisper卷会保留）：

```sh
docker compose --profile setup run --build --rm tts-model-download
docker compose up -d --build api tts web
backend/.venv/bin/python scripts/tts_smoke_test.py
```

音色下载固定仓库版本 `cf910fb59f1d79ab3b625a63993a108751c6c25d`。下载器保留模型卡，已存在文件不重复下载。测试实测正常句子2.47秒、0.6倍慢速3.82秒、单词1.21秒，重复请求返回一致音频。已通过浏览器按钮调用与换题恢复状态检查；iOS真机音频策略仍需实机验收。

依赖及授权说明见 [tts/THIRD_PARTY.md](tts/THIRD_PARTY.md)。


## 边录音边自动转写

点击麦克风后，AudioWorklet 连续采集声音；检测到音频能量后，每约1.5秒自动发送最新的完整 WAV 快照到原有 `/api/speech` 接口，返回结果直接更新文字，无需先点击结束。每个录音会话最多一个在途请求，不累计上传队列。结束时刷新剩余音频并进行最终转写；换题、切换输入模式或取消后，旧请求的结果不会覆盖当前题目。

这是基于本地 Whisper 的音频快照增量更新，显示延迟为采集间隔加推理耗时，并非逐字实时流式模型。中途结果可能随上下文修订，CPU负载较高时更新会变慢。录音上限仍为55秒，Nginx录音接口限流调整到60次/分钟，以支持连续转写。浏览器需在HTTPS（本机localhost除外）下支持 AudioWorklet；不支持时使用键盘输入。

执行 `npm run test:speech` 可验证录音中返回中间结果、WAV重采样、请求串行化、取消后忽略迟到结果，以及结束时补全最终音频。


## 管理员清空练习数据并重建题库

`RESET_ADMIN_EMAIL` 指定唯一可重置全库的管理员邮箱；留空则关闭入口。管理员登录后，在页面顶部点击“清空练习数据”，核验当前密码并确认范围，执行 `POST /api/admin/reset-practice`。

该操作对**所有账号**生效：删除全部答题记录和难点，经验/宝石/连胜归零、红心恢复5、清空上次练习日期，删除旧题库并从容器内 `app/exercises.json` 重建。账号ID、邮箱与密码哈希保留。仅保留发起重置的会话，其他设备需要重新登录。

服务器先完整校验题库非空、字段结构、难度及ID唯一性，再以单个MySQL事务锁定账号、清空数据并导入题目；出错会回滚。该操作不可通过页面撤销，执行前可自行备份数据库。普通账号无法调用该接口，Nginx对其单独限流。

更新句子后先修改 `backend/app/exercises.json`，再构建并部署 API：

```sh
docker compose build api
docker compose up -d api web
```

随后使用管理员页面入口重置，即从最新题库重新开始。**当前JSON含第9页18道教材题及23道演示题，共41题**；重置会如实载入这41题。若只要新句子，请先将JSON改为目标题目集合，再部署和重置。

普通 `python -m app.seed` 现在会同步更新同ID题目并插入新题；不会清空练习记录，也不会删除额外题目。它与全库重置用途不同，不再使用旧的“仅插入、不更新”行为。
