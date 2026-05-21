# Varg

Varg is a local-first desktop text-to-speech app scaffolded with Nuxt and Tauri.

## Development

Dependencies are declared but not installed in this workspace.

```powershell
npm install
npm run tauri:dev
```

## Local TTS Assets

Sprint 1 targets `sherpa-onnx-offline-tts.exe` as the Windows runtime. Place the runtime and starter model files under:

- `src-tauri/resources/tts/runtime/`
- `src-tauri/resources/tts/models/`

The backend command layer expects the model registry at `src-tauri/resources/tts/models/models.json` and writes generated WAV files to the app data directory.

