mod tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            tts::list_tts_models,
            tts::generate_speech
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Varg");
}
