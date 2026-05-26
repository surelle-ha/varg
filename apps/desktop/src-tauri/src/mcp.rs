use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{net::TcpListener, sync::oneshot, time};
use tower_http::cors::CorsLayer;

// ── Shared state types ────────────────────────────────────────────────────

pub type PendingTts = Arc<Mutex<HashMap<String, oneshot::Sender<Result<Vec<u8>, String>>>>>;

#[derive(Debug, Clone, Serialize)]
pub struct McpHistoryEntry {
    pub id: String,
    pub text: String,
    pub voice_id: String,
    pub speed: f64,
    pub file_path: String,
    pub duration_s: u64,
    pub timestamp: u64,
}

pub type McpHistory = Arc<Mutex<VecDeque<McpHistoryEntry>>>;

static REQ_ID: AtomicU64 = AtomicU64::new(1);

// ── Shared server context ──────────────────────────────────────────────────

#[derive(Clone)]
pub struct McpCtx {
    pub app: AppHandle,
    pub pending: PendingTts,
    pub history: McpHistory,
}

// ── JSON-RPC 2.0 types ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RpcReq {
    #[serde(default)]
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct RpcResp {
    jsonrpc: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
struct RpcError {
    code: i32,
    message: String,
}

impl RpcResp {
    fn ok(id: Option<Value>, result: Value) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: Some(result),
            error: None,
        }
    }
    fn err(id: Option<Value>, code: i32, msg: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: None,
            error: Some(RpcError {
                code,
                message: msg.into(),
            }),
        }
    }
}

// ── Server entry point ─────────────────────────────────────────────────────

pub async fn serve(app: AppHandle, port: u16) -> Result<(), String> {
    let pending = app.state::<PendingTts>().inner().clone();
    let history = app.state::<McpHistory>().inner().clone();
    let ctx = Arc::new(McpCtx {
        app,
        pending,
        history,
    });

    let router = Router::new()
        .route("/health", get(health_handler))
        .route("/mcp", post(mcp_handler))
        .layer(CorsLayer::permissive())
        .with_state(ctx);

    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .await
        .map_err(|e| format!("Cannot bind to port {port}: {e}"))?;

    axum::serve(listener, router)
        .await
        .map_err(|e| format!("MCP server error: {e}"))
}

// ── Handlers ───────────────────────────────────────────────────────────────

async fn health_handler() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "Varg MCP Server" }))
}

async fn mcp_handler(State(ctx): State<Arc<McpCtx>>, Json(req): Json<RpcReq>) -> Response {
    // JSON-RPC notifications have no `id` — spec says no response body, return 204.
    if req.id.is_none() {
        let _ = dispatch(ctx, &req.method, req.params).await;
        return StatusCode::NO_CONTENT.into_response();
    }

    let id = req.id.clone();
    let resp = match dispatch(ctx, &req.method, req.params).await {
        Ok(val) => RpcResp::ok(id, val),
        Err((code, m)) => RpcResp::err(id, code, m),
    };
    Json(resp).into_response()
}

// ── MCP dispatch ──────────────────────────────────────────────────────────

async fn dispatch(
    ctx: Arc<McpCtx>,
    method: &str,
    params: Option<Value>,
) -> Result<Value, (i32, String)> {
    match method {
        // ── Lifecycle ──────────────────────────────────────────────────
        "initialize" => Ok(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": {
                "name": "varg-mcp",
                "version": env!("CARGO_PKG_VERSION")
            }
        })),
        "notifications/initialized" | "ping" => Ok(json!(null)),

        // ── Tool listing ───────────────────────────────────────────────
        "tools/list" => Ok(json!({
            "tools": [
                {
                    "name": "generate_speech",
                    "description": "Convert text to speech using Varg's offline Kokoro TTS engine. Returns base64-encoded WAV audio. Varg must be open with the TTS model loaded.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "text": {
                                "type": "string",
                                "description": "Text to synthesize. Maximum 5000 characters."
                            },
                            "voice_id": {
                                "type": "string",
                                "description": "Voice ID. American female: af_heart (default ★), af_bella, af_nicole, af_sarah, af_kore, af_sky. American male: am_fenrir, am_michael, am_puck. British female: bf_emma ★, bf_alice. British male: bm_fable, bm_george. Use list_voices for the full list."
                            },
                            "speed": {
                                "type": "number",
                                "description": "Speech speed multiplier. Default 1.0, range 0.5–2.0."
                            }
                        },
                        "required": ["text"]
                    }
                },
                {
                    "name": "list_voices",
                    "description": "List all available Kokoro TTS voices with their IDs.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_history",
                    "description": "Return recent speech generations made via MCP. Each entry includes the text, voice, file path of the saved WAV, and timestamp.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "limit": {
                                "type": "integer",
                                "description": "Max entries to return (1–20, default 10)."
                            }
                        }
                    }
                }
            ]
        })),

        // ── Tool call ──────────────────────────────────────────────────
        "tools/call" => {
            let p = params.ok_or((-32602i32, "params required".to_string()))?;
            let name = p["name"]
                .as_str()
                .ok_or((-32602i32, "name required".to_string()))?;

            match name {
                "list_voices" => call_list_voices(),
                "generate_speech" => call_generate_speech(ctx, &p["arguments"]).await,
                "get_history" => call_get_history(ctx, &p["arguments"]),
                _ => Err((-32601, format!("Unknown tool: {name}"))),
            }
        }

        _ => Err((-32601, format!("Method not found: {method}"))),
    }
}

// ── Tool implementations ──────────────────────────────────────────────────

fn call_list_voices() -> Result<Value, (i32, String)> {
    let text = "\
American Female: af_heart (default ★), af_bella, af_nicole, af_sarah, af_kore, af_aoede, af_nova, af_sky, af_alloy, af_river, af_jessica\n\
American Male:   am_fenrir, am_michael, am_puck, am_echo, am_eric, am_liam, am_onyx, am_adam, am_santa\n\
British Female:  bf_emma (★), bf_isabella, bf_alice, bf_lily\n\
British Male:    bm_fable, bm_george, bm_daniel, bm_lewis";

    Ok(json!({ "content": [{ "type": "text", "text": text }] }))
}

async fn call_generate_speech(ctx: Arc<McpCtx>, args: &Value) -> Result<Value, (i32, String)> {
    let text = args["text"].as_str().unwrap_or("").to_string();
    if text.is_empty() {
        return Err((-32602, "text is required".into()));
    }
    if text.chars().count() > 5000 {
        return Err((-32602, "text exceeds 5000 character limit".into()));
    }

    let voice_id = args["voice_id"].as_str().unwrap_or("af_heart").to_string();
    let speed = args["speed"].as_f64().unwrap_or(1.0);

    let request_id = REQ_ID.fetch_add(1, Ordering::Relaxed).to_string();
    let (tx, rx) = oneshot::channel::<Result<Vec<u8>, String>>();
    ctx.pending.lock().unwrap().insert(request_id.clone(), tx);

    if let Err(e) = ctx.app.emit(
        "mcp:generate-speech",
        json!({
            "requestId": request_id,
            "text":      &text,
            "voiceId":   &voice_id,
            "speed":     speed,
        }),
    ) {
        ctx.pending.lock().unwrap().remove(&request_id);
        return Err((-32603, format!("Failed to reach Varg WebView: {e}")));
    }

    match time::timeout(std::time::Duration::from_secs(120), rx).await {
        Ok(Ok(Ok(audio_bytes))) => {
            // WAV: 44-byte header, 16-bit mono 24 kHz
            let duration_s = audio_bytes.len().saturating_sub(44) / 2 / 24_000;

            // Save to a stable temp file agents can reference by path
            let filename = format!("varg_tts_{request_id}.wav");
            let wav_path = std::env::temp_dir().join(&filename);
            std::fs::write(&wav_path, &audio_bytes)
                .map_err(|e| (-32603i32, format!("Failed to save WAV: {e}")))?;
            let path_str = wav_path.to_string_lossy().to_string();

            // Log to MCP history (capped at 20 entries)
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let entry = McpHistoryEntry {
                id: request_id.clone(),
                text: text.chars().take(120).collect(),
                voice_id: voice_id.clone(),
                speed,
                file_path: path_str.clone(),
                duration_s: duration_s as u64,
                timestamp,
            };
            {
                let mut hist = ctx.history.lock().unwrap();
                hist.push_front(entry);
                hist.truncate(20);
            }

            // Also notify the WebView so it can create an IndexedDB history entry
            let _ = ctx.app.emit(
                "mcp:tts-done",
                json!({
                    "text":      &text,
                    "voiceId":   &voice_id,
                    "speed":     speed,
                    "filePath":  &path_str,
                    "durationS": duration_s,
                }),
            );

            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!(
                        "Speech generated successfully.\nFile: {path_str}\nVoice: {voice_id} | Speed: {speed}x | Duration: ~{duration_s}s\n\nThe WAV file is saved and ready to use."
                    )
                }]
            }))
        }
        Ok(Ok(Err(e))) => Err((-32603, format!("TTS error: {e}"))),
        Ok(Err(_)) => Err((-32603, "TTS channel dropped unexpectedly".into())),
        Err(_) => {
            ctx.pending.lock().unwrap().remove(&request_id);
            Err((-32603, "TTS generation timed out after 120 s".into()))
        }
    }
}

fn call_get_history(ctx: Arc<McpCtx>, args: &Value) -> Result<Value, (i32, String)> {
    let limit = args["limit"].as_u64().unwrap_or(10).clamp(1, 20) as usize;
    let hist = ctx.history.lock().unwrap();
    let entries: Vec<&McpHistoryEntry> = hist.iter().take(limit).collect();

    if entries.is_empty() {
        return Ok(
            json!({ "content": [{ "type": "text", "text": "No MCP speech generations yet." }] }),
        );
    }

    let lines: Vec<String> = entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            format!(
                "{}. [{}] voice={} speed={:.1}x ~{}s\n   Text: {}\n   File: {}",
                i + 1,
                chrono_fmt(e.timestamp),
                e.voice_id,
                e.speed,
                e.duration_s,
                e.text,
                e.file_path
            )
        })
        .collect();

    Ok(json!({ "content": [{ "type": "text", "text": lines.join("\n\n") }] }))
}

fn chrono_fmt(ts: u64) -> String {
    // Simple UTC timestamp → human readable without external crates
    let secs = ts % 86400;
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    let s = secs % 60;
    format!("{h:02}:{m:02}:{s:02} UTC")
}
