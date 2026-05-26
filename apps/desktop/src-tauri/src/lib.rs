mod mcp;
mod tts;

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use mcp::{McpHistory, PendingTts};

// ── MCP server state ───────────────────────────────────────────────────────

struct McpInner {
    running: bool,
    port: u16,
    handle: Option<tauri::async_runtime::JoinHandle<()>>,
}

impl Default for McpInner {
    fn default() -> Self {
        Self {
            running: false,
            port: 3700,
            handle: None,
        }
    }
}

type McpState = Arc<Mutex<McpInner>>;

// ── MCP Tauri commands ─────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct McpStatus {
    running: bool,
    port: u16,
}

#[tauri::command]
async fn mcp_start(
    port: u16,
    app: AppHandle,
    state: tauri::State<'_, McpState>,
) -> Result<(), String> {
    let mcp = Arc::clone(state.inner());

    {
        let s = mcp.lock().unwrap();
        if s.running {
            return Err("MCP server is already running".into());
        }
    }

    let app_clone = app.clone();
    let handle = tauri::async_runtime::spawn(async move {
        if let Err(e) = mcp::serve(app_clone, port).await {
            eprintln!("[MCP] {e}");
        }
    });

    {
        let mut s = mcp.lock().unwrap();
        s.handle = Some(handle);
        s.running = true;
        s.port = port;
    }

    Ok(())
}

#[tauri::command]
fn mcp_stop(state: tauri::State<'_, McpState>) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if let Some(h) = s.handle.take() {
        h.abort();
    }
    s.running = false;
    Ok(())
}

#[tauri::command]
fn mcp_status(state: tauri::State<'_, McpState>) -> McpStatus {
    let s = state.lock().unwrap();
    McpStatus {
        running: s.running,
        port: s.port,
    }
}

// ── MCP TTS bridge commands ────────────────────────────────────────────────

#[tauri::command]
async fn mcp_tts_complete(
    request_id: String,
    audio_bytes: Vec<u8>,
    pending: tauri::State<'_, PendingTts>,
) -> Result<(), String> {
    let mut map = pending.lock().unwrap();
    if let Some(tx) = map.remove(&request_id) {
        let _ = tx.send(Ok(audio_bytes));
    }
    Ok(())
}

#[tauri::command]
async fn mcp_tts_error(
    request_id: String,
    error_msg: String,
    pending: tauri::State<'_, PendingTts>,
) -> Result<(), String> {
    let mut map = pending.lock().unwrap();
    if let Some(tx) = map.remove(&request_id) {
        let _ = tx.send(Err(error_msg));
    }
    Ok(())
}

// ── Splash screen ─────────────────────────────────────────────────────────

#[tauri::command]
fn close_splashscreen(app: AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

// ── App entry point ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show Varg", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Varg", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .manage(McpState::default())
        .manage(PendingTts::default())
        .manage(McpHistory::default())
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            tts::list_tts_models,
            tts::generate_speech,
            mcp_start,
            mcp_stop,
            mcp_status,
            mcp_tts_complete,
            mcp_tts_error,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Varg");
}
