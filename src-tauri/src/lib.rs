use tauri::Manager;

// Commands for file system operations
#[tauri::command]
async fn open_isometry_file() -> Result<String, String> {
    use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

    // TODO: Implement file dialog for .isometry files
    // For now, return placeholder
    Ok("placeholder-file-path".to_string())
}

#[tauri::command]
async fn save_isometry_file(data: String) -> Result<(), String> {
    // TODO: Implement save functionality with native file dialog
    println!("Saving data: {}", data);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_isometry_file,
            save_isometry_file
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
