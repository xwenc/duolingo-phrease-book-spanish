# Native speech dependencies

- [MLX Audio](https://github.com/Blaizzy/mlx-audio): MIT; installed version 0.6.5.
- [Ming-3.0-tts-0.5B-bf16](https://huggingface.co/mlx-community/Ming-3.0-tts-0.5B-bf16): MIT. Approximately 3GB model files, 44.1kHz output, Spanish target language `es`. Default model voice; optional built-in presets such as `UK_Charlotte`.
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 1.2.1 and [CTranslate2](https://github.com/OpenNMT/CTranslate2) 4.8.5: MIT. Default model: [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small); see its model card and license. STT runs on native CPU int8.

Models download on first startup into HF_HOME (the launch script defaults to `.local-test/huggingface`). Keep the upstream model cards and license files with redistributed weights. Model inference dependencies are installed only in the native speech environment; the API image uses an HTTP bridge.
