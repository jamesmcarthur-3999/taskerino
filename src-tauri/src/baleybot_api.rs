use serde::{Deserialize, Serialize};
use serde_json::json;
use std::process::Stdio;
use std::path::PathBuf;
use tauri::Emitter;
use tauri_plugin_store::StoreExt;
use tokio::process::Command as TokioCommand;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use which::which;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationHistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BaleybotRequest {
    pub stream_id: String,
    pub message: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub tools: Option<serde_json::Value>,
    pub agent_mode: bool,
    pub max_tool_iterations: Option<u32>,
    pub conversation_history: Option<Vec<ConversationHistoryMessage>>,
}

/// Baleybot invoke - spawns Bun process with BaleyBots SDK
#[tauri::command]
pub async fn baleybot_invoke(
    app: tauri::AppHandle,
    stream_id: String,
    request: BaleybotRequest,
) -> Result<(), String> {
    // Get API key from store
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = store
        .get("openai_api_key")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("OpenAI API key not set")?;

    // Spawn async task
    tokio::spawn(async move {
        if let Err(e) = run_baleybot_process(
            app.clone(),
            stream_id.clone(),
            api_key,
            request,
        )
        .await
        {
            let _ = app.emit(
                &format!("baleybot-stream-{}", stream_id),
                json!({
                    "type": "error",
                    "error": { "message": e }
                }),
            );
        }
    });

    Ok(())
}

/// Find project root by looking for package.json (workspace root)
/// Prioritizes package.json over Cargo.toml to ensure we find the workspace root,
/// not just the src-tauri directory
fn find_project_root() -> Result<PathBuf, String> {
    let mut current = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    loop {
        // Check if we're at the workspace root (has package.json)
        // This ensures we find the root where scripts/baleybot-worker.ts exists
        if current.join("package.json").exists() {
            // Verify the scripts directory exists to confirm this is the correct root
            if current.join("scripts").join("baleybot-worker.ts").exists() {
                return Ok(current);
            }
        }
        
        // Go up one directory
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => return Err("Could not find project root (no package.json found)".to_string()),
        }
    }
}

async fn run_baleybot_process(
    app: tauri::AppHandle,
    stream_id: String,
    api_key: String,
    request: BaleybotRequest,
) -> Result<(), String> {
    // Find Bun executable
    let bun_path = which("bun")
        .map_err(|_| "Bun not found. Please install Bun: curl -fsSL https://bun.sh/install | bash")?;

    // Find project root
    let project_root = find_project_root()?;
    let script_path = project_root.join("scripts").join("baleybot-worker.ts");
    
    if !script_path.exists() {
        return Err(format!(
            "BaleyBots worker script not found at: {}. Please ensure scripts/baleybot-worker.ts exists.",
            script_path.display()
        ));
    }

    // Build request JSON
    let request_json = json!({
        "streamId": stream_id,
        "message": request.message,
        "model": request.model,
        "systemPrompt": request.system_prompt,
        "tools": request.tools,
        "agentMode": request.agent_mode,
        "maxToolIterations": request.max_tool_iterations,
        "conversationHistory": request.conversation_history,
    });

    // Spawn Bun process with absolute path to script
    let mut child = TokioCommand::new(bun_path)
        .arg("run")
        .arg(script_path.as_os_str())
        .env("OPENAI_API_KEY", api_key)
        .current_dir(&project_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Bun: {}", e))?;

    // Write request to stdin
    if let Some(mut stdin) = child.stdin.take() {
        let request_str = serde_json::to_string(&request_json)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;
        stdin
            .write_all(request_str.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin.shutdown().await.map_err(|e| format!("Failed to close stdin: {}", e))?;
    }

    // Read stdout line by line (JSON events)
    if let Some(stdout) = child.stdout.take() {
        let mut reader = tokio::io::BufReader::new(stdout);
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
                    if let Ok(event) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        // Emit event to frontend
                        let _ = app.emit(&format!("baleybot-stream-{}", stream_id), event);
                    }
                }
                Err(e) => {
                    let _ = app.emit(
                        &format!("baleybot-stream-{}", stream_id),
                        json!({
                            "type": "error",
                            "error": { "message": format!("Failed to read stdout: {}", e) }
                        }),
                    );
                    break;
                }
            }
        }
    }

    // Wait for process to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Bun process failed: {}", e))?;

    if !status.success() {
        // Read stderr for error details
        if let Some(stderr) = child.stderr.take() {
            let mut reader = tokio::io::BufReader::new(stderr);
            let mut error_msg = String::new();
            let mut line = String::new();
            while reader.read_line(&mut line).await.is_ok() && !line.is_empty() {
                error_msg.push_str(&line);
                line.clear();
            }
            if !error_msg.trim().is_empty() {
                return Err(format!("Bun process failed: {}", error_msg));
            }
        }
        return Err("Bun process failed".to_string());
    }

    Ok(())
}

