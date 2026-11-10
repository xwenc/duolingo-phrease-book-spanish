# 本地朗读依赖

- 引擎：[OHF-Voice Piper](https://github.com/OHF-Voice/piper1-gpl)，PyPI `piper-tts==1.8.0`，GPL-3.0。Piper 包含的 eSpeak NG 也有其许可证；分发容器或软件时需要保留其许可信息，并按适用条款提供对应源码。独立服务部署不改变依赖自身的授权条款。
- 音色：`rhasspy/piper-voices` 的 `es_ES-davefx-medium`，下载器固定仓库版本并在音色卷保留 `MODEL_CARD`。[官方模型卡](https://huggingface.co/rhasspy/piper-voices/blob/cf910fb59f1d79ab3b625a63993a108751c6c25d/es/es_ES/davefx/medium/MODEL_CARD) 标明训练数据为 CC0，基底音色训练数据也为 CC0。分发音色时一并保留模型卡与仓库适用的许可说明。
- 模型在一次性设置步骤下载；服务运行期间只加载本地模型。FastAPI 业务后端通过内部 HTTP 调用独立 TTS 容器。
