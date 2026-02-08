use tauri::Manager;
use std::fs;

// Commands for file system operations
#[tauri::command]
async fn open_isometry_file(app_handle: tauri::AppHandle) -> Result<String, String> {
    // For now, return a status message showing we can handle file operations
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Ensure app data directory exists
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(format!("File dialog would open here. App data directory: {}", app_dir.display()))
}

#[tauri::command]
async fn save_isometry_file(app_handle: tauri::AppHandle, data: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create a test file to demonstrate file system access
    let test_file = app_dir.join("test-isometry-file.txt");

    fs::write(&test_file, data)
        .map_err(|e| format!("Failed to write test file: {}", e))?;

    Ok(format!("Test file saved to: {}", test_file.display()))
}

#[tauri::command]
async fn get_app_info(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let info = serde_json::json!({
        "name": "Isometry SuperGrid",
        "version": app_handle.package_info().version.to_string(),
        "app_data_dir": app_dir.to_string_lossy(),
        "desktop": true,
        "capabilities": {
            "file_system": true,
            "native_dialogs": true,
            "window_management": true
        }
    });

    Ok(info)
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
            save_isometry_file,
            get_app_info
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
