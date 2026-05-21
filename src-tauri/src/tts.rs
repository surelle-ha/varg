use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsVoice {
    pub id: String,
    pub name: String,
    pub locale: String,
    pub speaker_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsModel {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub model_path: String,
    pub tokens_path: String,
    pub data_dir: Option<String>,
    pub supports_gpu: bool,
    pub voices: Vec<TtsVoice>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSpeechRequest {
    pub text: String,
    pub model_id: String,
    pub voice_id: Option<String>,
    pub compute_target: ComputeTarget,
    pub speed: Option<f32>,
    pub pitch: Option<f32>,
    pub seed: Option<u64>,
    pub output_format: Option<OutputFormat>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ComputeTarget {
    Cpu,
    Gpu,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OutputFormat {
    Wav,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSpeechResponse {
    pub status: String,
    pub file_path: String,
    pub model_id: String,
    pub voice_id: Option<String>,
    pub elapsed_ms: u128,
    pub audio_bytes: Vec<u8>,
}

#[tauri::command]
pub fn list_tts_models(app: AppHandle) -> Result<Vec<TtsModel>, String> {
    let registry_path = tts_resource_dir(&app)?.join("models").join("models.json");
    let registry = fs::read_to_string(&registry_path).map_err(|err| {
        format!(
            "Unable to read model registry at {}: {err}",
            registry_path.display()
        )
    })?;

    serde_json::from_str::<Vec<TtsModel>>(&registry).map_err(|err| {
        format!(
            "Invalid model registry at {}: {err}",
            registry_path.display()
        )
    })
}

#[tauri::command]
pub fn generate_speech(
    app: AppHandle,
    request: GenerateSpeechRequest,
) -> Result<GenerateSpeechResponse, String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("Text is required.".into());
    }

    if text.chars().count() > 5000 {
        return Err("Text must be 5000 characters or fewer.".into());
    }

    if !matches!(
        request.output_format.unwrap_or(OutputFormat::Wav),
        OutputFormat::Wav
    ) {
        return Err("Only WAV output is supported in Sprint 1.".into());
    }

    let model = list_tts_models(app.clone())?
        .into_iter()
        .find(|model| model.id == request.model_id)
        .ok_or_else(|| format!("Unknown TTS model '{}'.", request.model_id))?;

    if matches!(request.compute_target, ComputeTarget::Gpu) && !model.supports_gpu {
        return Err("The selected model does not expose GPU generation yet.".into());
    }

    let tts_dir = tts_resource_dir(&app)?;
    let runtime_path = tts_dir.join("runtime").join(runtime_file_name());
    if !runtime_path.exists() {
        return Err(format!(
            "Bundled TTS runtime is missing at {}. Add sherpa-onnx-offline-tts.exe before packaging.",
            runtime_path.display()
        ));
    }

    let model_path = resolve_resource_path(&tts_dir, &model.model_path);
    let tokens_path = resolve_resource_path(&tts_dir, &model.tokens_path);
    if !model_path.exists() {
        return Err(format!(
            "Bundled model file is missing at {}.",
            model_path.display()
        ));
    }
    if !tokens_path.exists() {
        return Err(format!(
            "Bundled tokens file is missing at {}.",
            tokens_path.display()
        ));
    }

    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Unable to resolve app data directory: {err}"))?
        .join("generated");
    fs::create_dir_all(&output_dir).map_err(|err| {
        format!(
            "Unable to create output directory {}: {err}",
            output_dir.display()
        )
    })?;

    let output_path = output_dir.join(format!("speech-{}.wav", timestamp_ms()?));
    let mut command = Command::new(&runtime_path);
    command
        .arg(format!("--vits-model={}", model_path.display()))
        .arg(format!("--vits-tokens={}", tokens_path.display()))
        .arg(format!("--output-filename={}", output_path.display()))
        .arg(text);

    if let Some(data_dir) = &model.data_dir {
        let data_path = resolve_resource_path(&tts_dir, data_dir);
        if data_path.exists() {
            command.arg(format!("--vits-data-dir={}", data_path.display()));
        }
    }

    if let Some(voice_id) = &request.voice_id {
        if let Some(voice) = model.voices.iter().find(|voice| &voice.id == voice_id) {
            if let Some(speaker_id) = voice.speaker_id {
                command.arg(format!("--sid={speaker_id}"));
            }
        }
    }

    // Reserved for later features. Keeping the fields in the contract avoids a breaking change.
    let _future_options = (request.speed, request.pitch, request.seed, request.batch_id);

    let started = Instant::now();
    let output = command.output().map_err(|err| {
        format!(
            "Unable to execute TTS runtime {}: {err}",
            runtime_path.display()
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("TTS generation failed: {}", stderr.trim()));
    }

    if !output_path.exists() {
        return Err(format!(
            "TTS runtime completed but did not create {}.",
            output_path.display()
        ));
    }

    let audio_bytes = fs::read(&output_path).map_err(|err| {
        format!(
            "Unable to read generated audio {}: {err}",
            output_path.display()
        )
    })?;

    Ok(GenerateSpeechResponse {
        status: "completed".into(),
        file_path: output_path.to_string_lossy().to_string(),
        model_id: model.id,
        voice_id: request.voice_id,
        elapsed_ms: started.elapsed().as_millis(),
        audio_bytes,
    })
}

fn tts_resource_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map_err(|err| format!("Unable to resolve resource directory: {err}"))
        .map(|path| path.join("tts"))
}

fn resolve_resource_path(resource_root: &Path, relative_path: &str) -> PathBuf {
    resource_root.join(relative_path.replace('\\', "/"))
}

fn runtime_file_name() -> &'static str {
    if cfg!(windows) {
        "sherpa-onnx-offline-tts.exe"
    } else {
        "sherpa-onnx-offline-tts"
    }
}

fn timestamp_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|err| format!("System clock is before the Unix epoch: {err}"))
}
