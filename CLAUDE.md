# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Nuxt dev server + Tauri shell together)
pnpm tauri:dev

# Nuxt-only frontend (no Tauri window)
pnpm dev

# Type-check (vue-tsc via nuxi)
pnpm typecheck

# Production build (uses nuxt generate, not nuxt build — Tauri needs static files)
pnpm tauri:build

# Download Kokoro model files to public/models/
pnpm model:download
```

There are no tests in this project.

## Architecture

**Varg** is a fully offline desktop TTS (text-to-speech) app. The stack is:

- **Tauri 2** — native shell (`src-tauri/`). Rust side is minimal (no custom commands); Tauri is used only for the window frame, packaging, and CSP bypass (`"csp": null`). Window has `decorations: false` so the titlebar is a custom Vue component.
- **Nuxt 4 + Vue 3** — SPA (`ssr: false`) served to the Tauri WebView. All logic lives in the frontend.
- **kokoro-js 1.2.1** — wraps `@huggingface/transformers` v3 for ONNX inference.
- **OGL** — WebGL/WebGPU utility used by `Dither.vue`.

### App boot flow

`app.vue` drives a three-phase lifecycle: `'onboarding' → 'launch' → 'app'`. OnboardingScreen writes a profile to localStorage; LaunchScreen is a branded splash. Once in `'app'`, `AppShell.vue` renders.

### AppShell layout

```
AppShell
├── AppTitlebar          (custom draggable titlebar)
├── <nav> sidebar        (52px icon rail — Profile, Notebook, TTS, History, Monitor*, Model, Settings)
├── ContextMenu          (global right-click, scoped to <main>)
├── <main>               (panel area — only the active panel is mounted via v-if)
│   └── one of: ProfilePanel, NotebookPanel, TtsGenerationPanel, HistoryPanel,
│              SystemMonitorPanel, ModelPanel, SettingsPanel
├── AudioDrawer          (global bottom audio player, always mounted)
└── FloatingMonitor*     (draggable overlay widget)
```

`*` — both are hidden when `settings.showSystemMonitor` is `false`.

### Composables — module-level singletons

All composables use **module-scope `ref`s** so a single reactive state is shared across all component instances without prop drilling. This is intentional — never move state inside the exported function.

| Composable | Responsibility | Persistence |
|---|---|---|
| `useKokoro` | TTS worker lifecycle, audio state | none (in-memory) |
| `useSettings` | App preferences | `localStorage` (`varg-settings`) |
| `useNotebook` | Script/folder CRUD | `localStorage` (`varg-notebook`, `varg-notebook-folders`) |
| `useProfile` | User profile + avatar | `localStorage` (`varg-profile`) |
| `useHistory` | Generation history entries | IndexedDB (`varg` db, `history` store, max 50) |
| `useSystemMonitor` | Live CPU/GPU/heap metrics | none (polling) |

### TTS inference pipeline

`useKokoro` spawns a Web Worker (`workers/kokoro.worker.ts`) for off-main-thread ONNX inference.

**Init sequence** (`doInit`):
1. Check `transformers-cache` CacheStorage for `config.json` — if missing, post error immediately (don't attempt to warm or load).
2. Run `warmCaches` — populates CacheStorage from local static files at `${origin}/models/onnx-community/...` for files not already cached.
3. Probe WebGPU: attempt GPU load (`fp16` dtype + `device: 'webgpu'`). Requires `shader-f16` feature; falls back to CPU WASM (`q8` dtype) if absent or on failure.
4. Post `ready` message with the resolved device.

**Generate sequence**: Text is split into ~220-char chunks at sentence/clause boundaries. Each chunk calls `tts.generate()`. Silent audio (GPU-only check) triggers automatic CPU fallback via `handleGpuFallback`. Final WAV is encoded in-worker and transferred to the main thread.

**Cache management**: Model files are stored in browser CacheStorage under HuggingFace URL keys (`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/...`). `transformers-cache` holds config + ONNX files; `kokoro-voices` holds 28 `.bin` voice files. Deleting these caches via the Danger Zone also calls `reset()` to terminate the worker, preventing ghost generation from in-memory models.

### Audio routing

All generated audio flows through `AudioDrawer` (global bottom bar). History playback calls `loadExternal(wavBuffer, meta)` on `useKokoro` which writes the same refs that `AudioDrawer` watches — no separate audio element anywhere else.

### Notebook / Script Maker

Scripts are stored as `NotebookPage` objects (with optional `folderId`). The editor uses an overlay+textarea technique: the `<textarea>` text is `color: transparent` with visible `caret-color`, and a `<div>` overlay renders syntax-highlighted HTML on top. **Critical**: the overlay must not apply any CSS properties that affect text width (`font-weight`, `letter-spacing`, `font-style: italic`) — only colour, or the cursor will misalign.

Syntax: inline comments `@ … !@` (violet), section headers `=== title` (amber). Both are stripped before TTS generation.

### Design tokens (Tailwind)

Custom colour scale defined in `tailwind.config.ts`:

```
base → #1e1f22    surface → #2b2d31    overlay → #313338
subtle → #383a40  accent → #5865f2     ok → #23a55a
warn → #f0b232    err → #f23f42
```

Utility classes: `.glass-panel`, `.glass-input`, `.transition-ui` are defined in `assets/css/main.css`.

### Dither component

`components/Dither.vue` is a full WebGL component (OGL + custom GLSL) implementing animated Bayer-matrix dithering with Perlin noise. It accepts props: `waveSpeed`, `waveFrequency`, `waveAmplitude`, `waveColor`, `colorNum`, `pixelSize`, `enableMouseInteraction`, `mouseRadius`. Used as a decorative background — position it with `absolute inset-0` on a `relative overflow-hidden` parent.
