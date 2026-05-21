export type ComputeTarget = 'cpu' | 'gpu'
export type OutputFormat = 'wav'
export type TtsEngine = 'sherpa-onnx' | 'kokoro'

export interface TtsVoice {
  id: string
  name: string
  locale: string
  speakerId?: number
}

export interface TtsModel {
  id: string
  name: string
  engine: TtsEngine
  modelPath: string
  tokensPath: string
  dataDir?: string
  supportsGpu: boolean
  voices: TtsVoice[]
}

export interface GenerateSpeechRequest {
  text: string
  modelId: string
  voiceId?: string
  computeTarget: ComputeTarget
  speed?: number
  pitch?: number
  seed?: number
  outputFormat?: OutputFormat
  batchId?: string
}

export interface GenerateSpeechResponse {
  status: 'completed'
  filePath: string
  modelId: string
  voiceId?: string
  elapsedMs: number
  audioBytes: number[]
  audioUrl?: string
}

export interface KokoroVoice {
  id: string
  name: string
  gender: 'female' | 'male'
  accent: 'american' | 'british'
}
