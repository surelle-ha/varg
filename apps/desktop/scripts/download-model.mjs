#!/usr/bin/env node
/**
 * One-time setup: downloads Kokoro-82M-v1.0-ONNX model + voice files.
 *
 * Requires a free HuggingFace read token:
 *   1. Sign up at https://huggingface.co/join
 *   2. Create a read token at https://huggingface.co/settings/tokens
 *   3. Run (PowerShell):
 *        $env:HF_TOKEN="hf_xxxx"; pnpm model:download
 *
 * Downloads (~260 MB total):
 *   - config / tokenizer files
 *   - onnx/model_quantized.onnx   — CPU / WASM  (~88 MB)
 *   - onnx/model_q4f16.onnx       — GPU / WebGPU (~154 MB)
 *   - voices/*.bin                — 28 English voices (~14 MB)
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname }                         from 'node:path'
import { fileURLToPath }                         from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const REPO      = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const HF_BASE   = `https://huggingface.co/${REPO}/resolve/main`
const MODEL_DIR = join(ROOT, 'public', 'models', ...REPO.split('/'))
const TOKEN     = process.env.HF_TOKEN

// ── Guard ─────────────────────────────────────────────────────────────────────
if (!TOKEN) {
  console.error(`
❌  HF_TOKEN is not set.

HuggingFace requires a free access token to download models.

  1. Sign up at  https://huggingface.co/join
  2. Get a token https://huggingface.co/settings/tokens  (Read access)
  3. Run (PowerShell):

       $env:HF_TOKEN="hf_your_token_here"; pnpm model:download
`)
  process.exit(1)
}

// ── English voices (28 total) ─────────────────────────────────────────────────
// Sorted best → decent quality based on kokoro-js overallGrade metadata
const VOICES = [
  // American Female
  'af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_kore',
  'af_aoede', 'af_nova',  'af_sky',    'af_alloy', 'af_river', 'af_jessica',
  // American Male
  'am_fenrir', 'am_michael', 'am_puck', 'am_echo', 'am_eric',
  'am_liam',   'am_onyx',    'am_adam', 'am_santa',
  // British Female
  'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily',
  // British Male
  'bm_fable', 'bm_george', 'bm_daniel', 'bm_lewis',
]

// ── File list ─────────────────────────────────────────────────────────────────
const CONFIG_FILES = [
  { path: 'config.json',            required: true  },
  { path: 'tokenizer.json',         required: true  },
  { path: 'tokenizer_config.json',  required: false },
]

const MODEL_FILES = [
  { path: 'onnx/model_quantized.onnx', required: true,  label: 'CPU model (~88 MB)'  },
  { path: 'onnx/model_q4f16.onnx',     required: true,  label: 'GPU model (~154 MB)' },
]

const VOICE_FILES = VOICES.map(id => ({
  path:     `voices/${id}.bin`,
  required: true,
  label:    `voice: ${id}`,
}))

const ALL_FILES = [...CONFIG_FILES, ...MODEL_FILES, ...VOICE_FILES]

// ── Helpers ───────────────────────────────────────────────────────────────────
function bar(ratio, width = 26) {
  const n = Math.round(ratio * width)
  return '[' + '█'.repeat(n) + '░'.repeat(width - n) + ']'
}
function fmt(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

async function downloadFile({ path: relPath, required, label }) {
  const dest = join(MODEL_DIR, relPath)
  if (existsSync(dest)) {
    process.stdout.write(`  ✓ ${label ?? relPath}  (cached)\n`)
    return
  }
  mkdirSync(dirname(dest), { recursive: true })

  const url = `${HF_BASE}/${relPath}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error(`Token rejected (401). Check HF_TOKEN has read access.`)
    if (!required) { process.stdout.write(`  – ${label ?? relPath}  (not found, skipping)\n`); return }
    throw new Error(`HTTP ${res.status}: ${url}`)
  }

  const total    = Number(res.headers.get('content-length') ?? 0)
  let received   = 0
  const chunks   = []
  const tag      = label ?? relPath

  const timer = setInterval(() => {
    const ratio = total ? received / total : 0
    process.stdout.write(`\r  ↓ ${tag}  ${bar(ratio)} ${fmt(received)}${total ? '/' + fmt(total) : ''}   `)
  }, 150)

  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); received += value.length
  }
  clearInterval(timer)

  writeFileSync(dest, Buffer.concat(chunks))
  process.stdout.write(`\r  ✓ ${tag}  ${fmt(received)}${' '.repeat(40)}\n`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`Downloading ${REPO}…`)
console.log(`Destination: ${MODEL_DIR}\n`)

let ok = true
for (const file of ALL_FILES) {
  try {
    await downloadFile(file)
  } catch (err) {
    console.error(`\n  ✗ ${err.message}`)
    ok = false
  }
}

console.log(ok
  ? '\n✅  All files ready. The app will run fully offline.'
  : '\n❌  Some files failed — see errors above.'
)
if (!ok) process.exit(1)
