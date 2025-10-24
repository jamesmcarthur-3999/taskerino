use tauri_plugin_store::StoreExt;

/// Tauri command to set OpenAI API key
#[tauri::command]
pub fn set_openai_api_key(app: tauri::AppHandle, api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    store.set("openai_api_key", serde_json::json!(api_key.trim()));
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Tauri command to get OpenAI API key
#[tauri::command]
pub fn get_openai_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    match store.get("openai_api_key") {
        Some(value) => {
            if let Some(key) = value.as_str() {
                Ok(Some(key.to_string()))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

/// Tauri command to set Claude API key
#[tauri::command]
pub fn set_claude_api_key(app: tauri::AppHandle, api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    store.set("claude_api_key", serde_json::json!(api_key.trim()));
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Tauri command to get Claude API key
#[tauri::command]
pub fn get_claude_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    match store.get("claude_api_key") {
        Some(value) => {
            if let Some(key) = value.as_str() {
                Ok(Some(key.to_string()))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

/// Tauri command to check if OpenAI API key exists
#[tauri::command]
pub fn has_openai_api_key(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    Ok(store.get("openai_api_key").is_some())
}

/// Tauri command to check if Claude API key exists
#[tauri::command]
pub fn has_claude_api_key(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    Ok(store.get("claude_api_key").is_some())
}
