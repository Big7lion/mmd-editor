use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct CliArgs {
    file: Option<String>,
    theme: Option<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_cli::CliExt;
                match app.cli().matches() {
                    Ok(matches) => {
                        let file = matches.args.get("file").and_then(|v| v.value.as_str()).map(|s| s.to_string());
                        let theme = matches.args.get("theme").and_then(|v| v.value.as_str()).map(|s| s.to_string());
                        
                        let args = CliArgs { file, theme };
                        
                        let window = app.get_webview_window("main").unwrap();
                        window.eval(&format!("window.__CLI_ARGS__ = {};", serde_json::to_string(&args).unwrap())).ok();
                    }
                    Err(_) => {}
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
