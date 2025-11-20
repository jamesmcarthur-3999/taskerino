use serde_json::json;
use std::path::PathBuf;
use std::process::Stdio;
use std::collections::HashMap;
use std::sync::Arc;
use tauri_plugin_store::StoreExt;
use tauri::{Emitter, Listener};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::process::Command;
use tokio::process::Child;
use tokio::sync::Mutex;

/// Proxy handler state - manages the handler process stdin writer
struct ProxyHandlerState {
    stdin_writer: Option<Arc<Mutex<BufWriter<tokio::process::ChildStdin>>>>,
}

lazy_static::lazy_static! {
    static ref PROXY_HANDLER_STATE: Mutex<Option<ProxyHandlerState>> = Mutex::new(None);
}

/// Get API key for provider from Tauri store
fn get_api_key_for_provider(
    app: &tauri::AppHandle,
    provider: &str,
) -> Result<String, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let key_name = match provider {
        "anthropic" => "claude_api_key",
        "openai" => "openai_api_key",
        "google" => "google_api_key",
        "ollama" => return Ok(String::new()), // Ollama doesn't need keys
        _ => return Err(format!("Unknown provider: {}", provider)),
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

/// Get path to handler script
fn get_handler_script_path() -> Result<PathBuf, String> {
    // Get the executable directory (where the app is running from)
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get executable directory")?;
    
    // Handler script is at src-tauri/scripts/baleybot-handler.js
    // In production, this might be at different locations
    let possible_paths = vec![
        // Development: relative to exe
        exe_dir.join("scripts").join("baleybot-handler.js"),
        // Production: might be in resources
        exe_dir.join("resources").join("scripts").join("baleybot-handler.js"),
        // Or relative to current working directory
        PathBuf::from("src-tauri/scripts/baleybot-handler.js"),
        PathBuf::from("../src-tauri/scripts/baleybot-handler.js"),
    ];
    
    for path in possible_paths {
        if path.exists() {
            return Ok(path);
        }
    }
    
    Err("Handler script not found. Please ensure baleybot-handler.js exists in src-tauri/scripts/".to_string())
}

/// Spawn handler process with API keys
async fn spawn_handler_process(
    app: &tauri::AppHandle,
) -> Result<Child, String> {
    // Get all API keys
    let anthropic_key = get_api_key_for_provider(app, "anthropic").unwrap_or_default();
    let openai_key = get_api_key_for_provider(app, "openai").unwrap_or_default();
    let google_key = get_api_key_for_provider(app, "google").unwrap_or_default();
    let ollama_key = get_api_key_for_provider(app, "ollama").unwrap_or_default();
    
    // Get handler script path
    let handler_script = get_handler_script_path()?;
    
    // Find Node.js executable
    let node_exe = which::which("node")
        .or_else(|_| which::which("nodejs"))
        .map_err(|_| "Node.js not found. Please install Node.js to use AI providers.".to_string())?;
    
    // Spawn handler process with API keys as environment variables
    let child = Command::new(node_exe)
        .arg(&handler_script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("ANTHROPIC_API_KEY", anthropic_key)
        .env("OPENAI_API_KEY", openai_key)
        .env("GOOGLE_API_KEY", google_key)
        .env("OLLAMA_API_KEY", ollama_key)
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;
    
    Ok(child)
}

/// Initialize proxy handler - spawns the handler process and sets up event listeners
pub async fn init_proxy_handler(app: tauri::AppHandle) -> Result<(), String> {
    // Spawn handler process
    let mut child = spawn_handler_process(&app).await?;
    
    // Take stdin/stdout/stderr
    let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take();
    
    // Create stdin writer and store it
    let stdin_writer = Arc::new(Mutex::new(BufWriter::new(stdin)));
    let mut state_guard = PROXY_HANDLER_STATE.lock().await;
    *state_guard = Some(ProxyHandlerState {
        stdin_writer: Some(stdin_writer.clone()),
    });
    drop(state_guard);
    
    // Clone app handle for async tasks
    let app_handle = app.clone();
    let app_handle_for_listener = app.clone();
    
    // Spawn task to read responses from stdout
    let app_handle_stdout = app_handle.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    
                    // Parse response JSON
                    match serde_json::from_str::<serde_json::Value>(trimmed) {
                        Ok(response) => {
                            if let Some(request_id) = response.get("requestId").and_then(|v| v.as_str()) {
                                let status = response.get("status").and_then(|v| v.as_u64()).unwrap_or(200) as u16;
                                let headers = response.get("headers")
                                    .and_then(|v| v.as_object())
                                    .map(|obj| {
                                        obj.iter()
                                            .filter_map(|(k, v)| {
                                                v.as_str().map(|v_str| (k.clone(), v_str.to_string()))
                                            })
                                            .collect::<HashMap<String, String>>()
                                    })
                                    .unwrap_or_default();
                                let body = response.get("body").and_then(|v| v.as_str()).unwrap_or("");
                                let done = response.get("done").and_then(|v| v.as_bool()).unwrap_or(true);
                                
                                // Emit response via Tauri event
                                let _ = app_handle_stdout.emit(
                                    "baleybot-proxy-response",
                                    json!({
                                        "requestId": request_id,
                                        "status": status,
                                        "headers": headers,
                                        "body": body,
                                        "done": done,
                                    }),
                                );
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to parse response: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read from stdout: {}", e);
                    break;
                }
            }
        }
    });
    
    // Spawn task to read errors from stderr
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        eprintln!("[Handler] {}", line.trim());
                    }
                    Err(_) => break,
                }
            }
        });
    }
    
    // Keep child process alive (don't drop it)
    tokio::spawn(async move {
        let _ = child.wait().await;
    });
    
    // Listen for proxy requests via Tauri events
    app.listen("baleybot-proxy-request", move |event| {
        let app_handle = app_handle_for_listener.clone();
        let stdin_writer = stdin_writer.clone();
        
        tokio::spawn(async move {
            // Parse event payload as JSON
            // event.payload() returns &str, so we need to parse it with serde_json::from_str
            let payload_str = event.payload();
            let payload: serde_json::Value = match serde_json::from_str(payload_str) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Failed to parse event payload: {}", e);
                    return;
                }
            };
            
            // Extract request data
            let request_id = payload.get("requestId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let method = payload.get("method")
                .and_then(|v| v.as_str())
                .unwrap_or("POST");
            let path = payload.get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let headers = payload.get("headers")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| {
                            v.as_str().map(|v_str| (k.clone(), v_str.to_string()))
                        })
                        .collect::<HashMap<String, String>>()
                })
                .unwrap_or_default();
            let body = payload.get("body")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let query = payload.get("query")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| {
                            v.as_str().map(|v_str| (k.clone(), v_str.to_string()))
                        })
                        .collect::<HashMap<String, String>>()
                })
                .unwrap_or_default();
            
            // Build request JSON for handler
            let request_json = json!({
                "type": "request",
                "requestId": request_id,
                "method": method,
                "path": path,
                "headers": headers,
                "body": body,
                "query": query,
            });
            
            // Write request to handler stdin
            let mut writer = stdin_writer.lock().await;
            if let Err(e) = writer.write_all(request_json.to_string().as_bytes()).await {
                eprintln!("Failed to write to handler stdin: {}", e);
                // Emit error response
                let _ = app_handle.emit(
                    "baleybot-proxy-response",
                    json!({
                        "requestId": request_id,
                        "status": 500,
                        "headers": {},
                        "body": json!({"error": format!("Failed to write to handler: {}", e)}),
                        "done": true,
                    }),
                );
                return;
            }
            
            if let Err(e) = writer.write_all(b"\n").await {
                eprintln!("Failed to write newline to handler stdin: {}", e);
                return;
            }
            
            if let Err(e) = writer.flush().await {
                eprintln!("Failed to flush handler stdin: {}", e);
                return;
            }
        });
    });
    
    Ok(())
}

