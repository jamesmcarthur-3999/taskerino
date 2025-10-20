use crate::ai_types::*;
use reqwest::Client;
use serde_json::json;
use futures_util::StreamExt;
use tauri::Emitter;
use tauri_plugin_store::StoreExt;

const CLAUDE_API_BASE: &str = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Claude chat completion (non-streaming) with automatic retry for transient errors
#[tauri::command]
pub async fn claude_chat_completion(
    app: tauri::AppHandle,
    request: ClaudeChatRequest,
) -> Result<ClaudeChatResponse, String> {
    let store = app.store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("claude_api_key") {
        Some(value) => value.as_str()
            .ok_or("Claude API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => return Err("Claude API key not set. Please add your API key in Settings.".to_string())
    };

    let client = Client::new();

    let mut request_body = json!({
        "model": request.model,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
    });

    if let Some(system) = request.system {
        request_body["system"] = json!(system);
    }

    if let Some(temperature) = request.temperature {
        request_body["temperature"] = json!(temperature);
    }

    // Retry logic for transient errors (520, 502, 503, 504)
    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        if attempt > 0 {
            // Exponential backoff: 1s, 2s, 4s
            let delay_ms = 1000 * (2_u64.pow(attempt as u32));
            println!("Retrying Claude API request (attempt {}/{}) after {}ms delay...", attempt + 1, max_retries, delay_ms);
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }

        let response = match client
            .post(&format!("{}/messages", CLAUDE_API_BASE))
            .header("x-api-key", &api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("anthropic-beta", "prompt-caching-2024-07-31")
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                last_error = format!("Network error: {}", e);
                continue; // Retry on network errors
            }
        };

        let status = response.status();
        let status_code = status.as_u16();

        // Don't retry auth errors - fail immediately
        if status_code == 401 {
            return Err("Invalid Claude API key. Please check your key in Settings.".to_string());
        }

        // Don't retry rate limits - fail immediately with helpful message
        if status_code == 429 {
            return Err("Claude rate limit exceeded. Please try again later.".to_string());
        }

        // Retry on server errors (500-599) and Cloudflare errors (520-527)
        if status_code >= 500 || (status_code >= 520 && status_code < 530) {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            last_error = match status_code {
                502 => "Anthropic API gateway error (502). The API is temporarily unavailable.".to_string(),
                503 => "Anthropic API service unavailable (503). The service is temporarily down.".to_string(),
                504 => "Anthropic API timeout (504). The request took too long.".to_string(),
                520 => "Cloudflare error (520). Anthropic's servers are temporarily unreachable.".to_string(),
                521 => "Cloudflare error (521). Anthropic's servers are down.".to_string(),
                _ => format!("Server error ({}): {}", status_code, error_text),
            };

            println!("Transient error on attempt {}: {}", attempt + 1, last_error);
            continue; // Retry
        }

        // Other non-success status codes - fail immediately
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Claude API error ({}): {}", status, error_text));
        }

        // Success - parse and return response
        let claude_response: ClaudeChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        return Ok(claude_response);
    }

    // All retries exhausted
    Err(format!(
        "Claude API request failed after {} attempts. Last error: {}. Please try again in a few moments.",
        max_retries,
        last_error
    ))
}

/// Claude chat completion with vision support (for screenshots and image attachments)
#[tauri::command]
pub async fn claude_chat_completion_vision(
    app: tauri::AppHandle,
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
    system: Option<String>,
    temperature: Option<f32>,
) -> Result<ClaudeChatResponse, String> {
    let request = ClaudeChatRequest {
        model,
        max_tokens,
        messages,
        system: system.map(|s| serde_json::Value::String(s)),
        temperature,
    };

    claude_chat_completion(app, request).await
}

/// Claude streaming chat completion (for Ned chat)
/// Returns a stream ID that can be used to listen for events
#[tauri::command]
pub async fn claude_chat_completion_stream(
    app: tauri::AppHandle,
    stream_id: String,
    request: ClaudeStreamingRequest,
) -> Result<(), String> {
    let store = app.store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("claude_api_key") {
        Some(value) => value.as_str()
            .ok_or("Claude API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => return Err("Claude API key not set. Please add your API key in Settings.".to_string())
    };

    // Spawn async task to handle streaming
    tauri::async_runtime::spawn(async move {
        if let Err(e) = stream_claude_response(app, stream_id, api_key, request).await {
            eprintln!("Streaming error: {}", e);
        }
    });

    Ok(())
}

/// Internal function to handle streaming Claude responses
async fn stream_claude_response(
    app: tauri::AppHandle,
    stream_id: String,
    api_key: String,
    request: ClaudeStreamingRequest,
) -> Result<(), String> {
    let client = Client::new();

    let mut request_body = json!({
        "model": request.model,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
        "stream": true,
    });

    if let Some(system) = request.system {
        request_body["system"] = json!(system);
    }

    if let Some(temperature) = request.temperature {
        request_body["temperature"] = json!(temperature);
    }

    if let Some(tools) = request.tools {
        request_body["tools"] = json!(tools);
    }

    if let Some(extended_thinking) = request.extended_thinking {
        request_body["extended_thinking"] = json!(extended_thinking);
    }

    // DEBUG: Log the actual request being sent
    println!("[Claude API] Request body:");
    println!("{}", serde_json::to_string_pretty(&request_body).unwrap_or_else(|_| "Failed to serialize".to_string()));

    let response = client
        .post(&format!("{}/messages", CLAUDE_API_BASE))
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("anthropic-beta", "prompt-caching-2024-07-31")
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Claude API request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());

        // Emit error event
        let _ = app.emit(
            &format!("claude-stream-{}", stream_id),
            json!({
                "type": "error",
                "error": {
                    "message": format!("Claude API error ({}): {}", status, error_text)
                }
            }),
        );
        return Err(format!("Claude API error ({}): {}", status, error_text));
    }

    // Process SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                buffer.push_str(&chunk_str);

                // Process complete SSE events
                while let Some(event_end) = buffer.find("\n\n") {
                    let event = buffer[..event_end].to_string();
                    buffer = buffer[event_end + 2..].to_string();

                    // SSE events can have multiple lines (event: ..., data: ..., etc.)
                    // We need to extract the data: line specifically
                    for line in event.lines() {
                        if line.starts_with("data: ") {
                            let data = &line[6..];

                            // Skip ping events
                            if data == "[DONE]" || data.trim().is_empty() {
                                continue;
                            }

                            // Parse JSON data
                            match serde_json::from_str::<serde_json::Value>(data) {
                            Ok(json_data) => {
                                // Log event type for debugging
                                if let Some(event_type) = json_data.get("type") {
                                    println!("[Claude Stream] Event type: {}", event_type);
                                    if event_type == "content_block_delta" {
                                        println!("[Claude Stream] Delta: {:?}", json_data.get("delta"));
                                    }
                                }

                                // Emit event to frontend
                                let _ = app.emit(
                                    &format!("claude-stream-{}", stream_id),
                                    json_data,
                                );
                            }
                            Err(e) => {
                                eprintln!("Failed to parse SSE data: {}", e);
                                eprintln!("Raw data: {}", data);
                            }
                        }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = app.emit(
                    &format!("claude-stream-{}", stream_id),
                    json!({
                        "type": "error",
                        "error": {
                            "message": format!("Stream error: {}", e)
                        }
                    }),
                );
                return Err(format!("Stream error: {}", e));
            }
        }
    }

    // Emit completion event
    let _ = app.emit(
        &format!("claude-stream-{}", stream_id),
        json!({
            "type": "stream_end"
        }),
    );

    Ok(())
}
