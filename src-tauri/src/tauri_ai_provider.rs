use crate::ai_types::*;
use serde_json::json;
use std::path::PathBuf;
use std::process::Stdio;
use tauri_plugin_store::StoreExt;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

/// Emit a stream error event to Tauri
fn emit_stream_error(app: &tauri::AppHandle, stream_id: &str, error: String) {
    let error_event = json!({
        "type": "error",
        "error": {
            "message": error
        }
    });
    let _ = app.emit(
        &format!("tauri-stream-event-{}", stream_id),
        TauriStreamEventPayload {
            stream_id: stream_id.to_string(),
            event: error_event,
        },
    );
}

/// Prepare bridge request: get API key, inject it, build request JSON, find script and Node.js
/// Returns: (request_json, bridge_script_path, node_exe_path)
async fn prepare_bridge_request(
    app: &tauri::AppHandle,
    request: &TauriChatCompletionRequest,
) -> Result<(String, PathBuf, PathBuf), String> {
    // Get API key from Tauri store
    let api_key = get_api_key_for_provider(app, &request.provider_type)?;

    // Inject API key into config
    let mut config = request.config.clone();
    if let Some(config_obj) = config.as_object_mut() {
        config_obj.insert("apiKey".to_string(), serde_json::Value::String(api_key));
    }
    
    // Build request for bridge script
    let bridge_request = json!({
        "providerType": match request.provider_type {
            TauriProviderType::Anthropic => "anthropic",
            TauriProviderType::Openai => "openai",
            TauriProviderType::Google => "google",
            TauriProviderType::Ollama => "ollama",
        },
        "model": request.model,
        "params": request.params,
        "config": config,
    });
    
    // Serialize request to JSON
    let request_json = serde_json::to_string(&bridge_request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;
    
    // Get bridge script path
    let bridge_script = get_bridge_script_path()?;
    
    // Find Node.js executable
    let node_exe = which::which("node")
        .or_else(|_| which::which("nodejs"))
        .map_err(|_| "Node.js not found. Please install Node.js to use AI providers.".to_string())?;
    
    Ok((request_json, bridge_script, node_exe))
}

/// Spawn bridge process and write request to stdin
/// Returns the spawned child process with stdin consumed and stdout ready to read
async fn spawn_bridge_process(
    script_path: PathBuf,
    node_exe: PathBuf,
    request_json: String,
) -> Result<tokio::process::Child, String> {
    let mut child = Command::new(node_exe)
        .arg(&script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;
    
    // Write request to stdin
    if let Some(stdin) = child.stdin.take() {
        let mut writer = tokio::io::BufWriter::new(stdin);
        writer.write_all(request_json.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        writer.write_all(b"\n").await
            .map_err(|e| format!("Failed to write newline to stdin: {}", e))?;
        writer.flush().await
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;
    }
    
    Ok(child)
}

/// Handle a Result for streaming context - emit error and return None if error
fn handle_stream_result<T>(
    result: Result<T, String>,
    app: &tauri::AppHandle,
    stream_id: &str,
) -> Option<T> {
    match result {
        Ok(value) => Some(value),
        Err(error) => {
            emit_stream_error(app, stream_id, error);
            None
        }
    }
}

/// Get API key for provider from Tauri store
fn get_api_key_for_provider(
    app: &tauri::AppHandle,
    provider_type: &TauriProviderType,
) -> Result<String, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let key_name = match provider_type {
        TauriProviderType::Anthropic => "claude_api_key",
        TauriProviderType::Openai => "openai_api_key",
        TauriProviderType::Google => "google_api_key",
        TauriProviderType::Ollama => return Ok(String::new()), // Ollama doesn't need keys
    };

    match store.get(key_name) {
        Some(value) => {
            if let Some(key) = value.as_str() {
                Ok(key.to_string())
            } else {
                Err(format!("{} not set. Please add your API key in Settings.", key_name))
            }
        }
        None => Err(format!("{} not set. Please add your API key in Settings.", key_name)),
    }
}

/// Get path to bridge script
fn get_bridge_script_path() -> Result<PathBuf, String> {
    // Get the executable directory (where the app is running from)
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get executable directory")?;
    
    // Bridge script is at src-tauri/scripts/baleybots-bridge.js
    // In production, this might be at different locations
    // Try multiple possible locations
    let possible_paths = vec![
        // Development: relative to exe
        exe_dir.join("scripts").join("baleybots-bridge.js"),
        // Production: might be in resources
        exe_dir.join("resources").join("scripts").join("baleybots-bridge.js"),
        // Or relative to current working directory
        PathBuf::from("src-tauri/scripts/baleybots-bridge.js"),
        PathBuf::from("../src-tauri/scripts/baleybots-bridge.js"),
    ];
    
    for path in possible_paths {
        if path.exists() {
            return Ok(path);
        }
    }
    
    Err("Bridge script not found. Please ensure baleybots-bridge.js exists in src-tauri/scripts/".to_string())
}

/// Non-streaming chat completion
#[tauri::command]
pub async fn tauri_ai_chat_completion(
    app: tauri::AppHandle,
    request: TauriChatCompletionRequest,
) -> Result<String, String> {
    // Prepare request: get API key, build JSON, find script and Node.js
    let (request_json, bridge_script, node_exe) = prepare_bridge_request(&app, &request).await?;
    
    // Spawn bridge process and write request
    let mut child = spawn_bridge_process(bridge_script, node_exe, request_json).await?;
    
    // Read response from stdout (single JSON line)
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    
    reader.read_line(&mut line).await
        .map_err(|e| format!("Failed to read from stdout: {}", e))?;
    
    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for process: {}", e))?;
    
    if !status.success() {
        // Read stderr for error details
        let stderr = child.stderr.take();
        if let Some(mut stderr_reader) = stderr {
            let mut error_output = String::new();
            let mut stderr_buf = BufReader::new(stderr_reader);
            stderr_buf.read_to_string(&mut error_output).await.ok();
            return Err(format!("Bridge script failed: {}", error_output));
        }
        return Err("Bridge script failed with unknown error".to_string());
    }
    
    // Parse response (baleybots ChatCompletionResult as JSON)
    let result: serde_json::Value = serde_json::from_str(line.trim())
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Return as JSON string
    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e))
}

/// Streaming chat completion - starts stream and emits events
#[tauri::command]
pub async fn tauri_ai_chat_completion_stream_start(
    app: tauri::AppHandle,
    request: TauriChatCompletionRequest,
) -> Result<TauriStreamStartResponse, String> {
    // Generate stream_id FIRST - this is instant
    let stream_id = format!("stream_{}_{}", 
        chrono::Utc::now().timestamp_millis(),
        uuid::Uuid::new_v4().to_string().split_at(8).0
    );

    // Clone what we need for the spawned task
    let app_handle = app.clone();
    let stream_id_clone = stream_id.clone();
    let request_clone = request.clone();

    // Spawn task IMMEDIATELY - move all blocking work into it
    tokio::spawn(async move {
        // Prepare request: get API key, build JSON, find script and Node.js
        let (request_json, bridge_script, node_exe) = match prepare_bridge_request(&app_handle, &request_clone).await {
            Ok(result) => result,
            Err(e) => {
                emit_stream_error(&app_handle, &stream_id_clone, e);
                return;
            }
        };
        
        // Spawn bridge process and write request
        let mut child = match spawn_bridge_process(bridge_script, node_exe, request_json).await {
            Ok(child) => child,
            Err(e) => {
                emit_stream_error(&app_handle, &stream_id_clone, e);
                return;
            }
        };
        
        // Read events from stdout (one JSON line per event)
        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                emit_stream_error(&app_handle, &stream_id_clone, "Failed to capture stdout".to_string());
                return;
            }
        };
        
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        
        // Read events line by line
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    // EOF - stream complete
                    // Emit message_stop event before breaking to notify frontend
                    let done_event = json!({
                        "type": "message_stop"
                    });
                    let _ = app_handle.emit(
                        &format!("tauri-stream-event-{}", stream_id_clone),
                        TauriStreamEventPayload {
                            stream_id: stream_id_clone.clone(),
                            event: done_event,
                        },
                    );
                    break;
                }
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    
                    // Parse event JSON
                    match serde_json::from_str::<serde_json::Value>(trimmed) {
                        Ok(event) => {
                            // Log event type for diagnostics
                            if let Some(event_type) = event.get("type").and_then(|v| v.as_str()) {
                                eprintln!("[TauriProvider] Emitting event type: {}", event_type);
                                
                                // Log tool call events specifically with full structure
                                if event_type.contains("tool_call") {
                                    eprintln!("[TauriProvider] Tool call event detected: {}", event_type);
                                    if let Ok(event_json) = serde_json::to_string(&event) {
                                        eprintln!("[TauriProvider] Tool call event JSON: {}", event_json);
                                    }
                                }
                            }
                            
                            // Emit event to Tauri
                            let _ = app_handle.emit(
                                &format!("tauri-stream-event-{}", stream_id_clone),
                                TauriStreamEventPayload {
                                    stream_id: stream_id_clone.clone(),
                                    event: event.clone(),
                                },
                            );
                            
                            // Check if stream is complete
                            if let Some(event_type) = event.get("type").and_then(|v| v.as_str()) {
                                if event_type == "message_stop" || event_type == "error" {
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[TauriProvider] Failed to parse event: {}", e);
                            // Continue reading - might be a partial line
                        }
                    }
                }
                Err(e) => {
                    emit_stream_error(&app_handle, &stream_id_clone, format!("Failed to read from stdout: {}", e));
                    break;
                }
            }
        }
        
        // Wait for process to complete
        let _ = child.wait().await;
    });

    // Return immediately - command handler returns instantly
    Ok(TauriStreamStartResponse {
        stream_id,
        success: true,
        error: None,
    })
}
