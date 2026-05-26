import { invoke } from '@tauri-apps/api/core'
import type { GenerateSpeechRequest, GenerateSpeechResponse, TtsModel } from '~/types/tts'

export function useTts() {
  const models = ref<TtsModel[]>([])
  const output = ref<GenerateSpeechResponse | null>(null)
  const loadingModels = ref(false)
  const generating = ref(false)
  const error = ref('')
  let currentObjectUrl = ''

  async function loadModels() {
    loadingModels.value = true
    error.value = ''

    try {
      models.value = await invoke<TtsModel[]>('list_tts_models')
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loadingModels.value = false
    }
  }

  async function generateSpeech(request: GenerateSpeechRequest) {
    generating.value = true
    error.value = ''
    output.value = null

    try {
      const response = await invoke<GenerateSpeechResponse>('generate_speech', { request })
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
      }

      const audioBytes = new Uint8Array(response.audioBytes)
      currentObjectUrl = URL.createObjectURL(new Blob([audioBytes], { type: 'audio/wav' }))
      output.value = {
        ...response,
        audioUrl: currentObjectUrl
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      generating.value = false
    }
  }

  return {
    models,
    output,
    loadingModels,
    generating,
    error,
    loadModels,
    generateSpeech
  }
}
