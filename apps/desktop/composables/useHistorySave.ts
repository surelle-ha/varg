import { mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'

export interface GenerationSaveParams {
  wav:        ArrayBuffer
  text:       string
  voice:      string
  speed:      number
  device:     'gpu' | 'cpu'
  duration:   number
  elapsedMs:  number
  timestamp:  number
  source:     'tts' | 'mcp'
  batchId?:   string
  partIndex?: number
  partTotal?: number
}

export async function saveGenerationToDisk(
  params: GenerationSaveParams,
  batchDirSlug?: string,
): Promise<string> {
  const d   = new Date(params.timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const slug = batchDirSlug ?? [
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
    params.voice,
  ].join('-')

  const dataDir = await appDataDir()
  const genDir  = await join(dataDir, 'history', slug)
  await mkdir(genDir, { recursive: true })

  const isBatch    = params.partIndex !== undefined
  const partSuffix = isBatch
    ? `_${String((params.partIndex ?? 0) + 1).padStart(2, '0')}`
    : ''

  await writeFile(
    await join(genDir, `audio${partSuffix}.wav`),
    new Uint8Array(params.wav),
  )

  const meta = {
    generatedAt: new Date(params.timestamp).toISOString(),
    source:      params.source,
    text:        params.text,
    voice:       params.voice,
    speed:       params.speed,
    device:      params.device,
    duration:    Number(params.duration.toFixed(3)),
    elapsedMs:   params.elapsedMs,
    ...(isBatch && {
      batchId:   params.batchId,
      partIndex: params.partIndex,
      partTotal: params.partTotal,
    }),
  }

  await writeFile(
    await join(genDir, `meta${partSuffix}.json`),
    new TextEncoder().encode(JSON.stringify(meta, null, 2)),
  )

  return genDir
}
