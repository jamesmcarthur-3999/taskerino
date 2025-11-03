use crate::ai_types::*;
use reqwest::Client;
use serde_json::json;
use std::time::Duration;
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
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("claude_api_key") {
        Some(value) => value
            .as_str()
            .ok_or("Claude API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => {
            return Err("Claude API key not set. Please add your API key in Settings.".to_string())
        }
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(1200)) // 20 min total timeout (for large canvas generation)
        .connect_timeout(Duration::from_secs(30)) // 30 sec to establish connection
        .read_timeout(Duration::from_secs(900)) // 15 min to read response (large sessions can take 5-10 min)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

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

    if let Some(tools) = request.tools {
        request_body["tools"] = json!(tools);
    }

    // Retry logic for transient errors (520, 502, 503, 504)
    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        if attempt > 0 {
            // Exponential backoff: 1s, 2s, 4s
            let delay_ms = 1000 * (2_u64.pow(attempt as u32));
            println!(
                "Retrying Claude API request (attempt {}/{}) after {}ms delay...",
                attempt + 1,
                max_retries,
                delay_ms
            );
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
                502 => "Anthropic API gateway error (502). The API is temporarily unavailable."
                    .to_string(),
                503 => "Anthropic API service unavailable (503). The service is temporarily down."
                    .to_string(),
                504 => "Anthropic API timeout (504). The request took too long.".to_string(),
                520 => "Cloudflare error (520). Anthropic's servers are temporarily unreachable."
                    .to_string(),
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

        // Check for truncation (stop_reason: "max_tokens")
        if let Some(stop_reason) = &claude_response.stop_reason {
            if stop_reason == "max_tokens" {
                eprintln!("⚠️  WARNING: Claude response truncated due to max_tokens limit!");
                eprintln!("   Requested: {} tokens", request.max_tokens);
                eprintln!(
                    "   Output tokens used: {}",
                    claude_response.usage.output_tokens
                );
                return Err(format!(
                    "Response truncated: hit max_tokens limit of {}. Output used {} tokens. Increase token limit or implement chunking.",
                    request.max_tokens,
                    claude_response.usage.output_tokens
                ));
            }
        }

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
    tools: Option<Vec<ClaudeTool>>,
) -> Result<ClaudeChatResponse, String> {
    let request = ClaudeChatRequest {
        model,
        max_tokens,
        messages,
        system: system.map(|s| serde_json::Value::String(s)),
        temperature,
        tools,
    };

    claude_chat_completion(app, request).await
}
