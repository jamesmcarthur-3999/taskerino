use crate::ai_types::*;
use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use tauri_plugin_store::StoreExt;

const OPENAI_API_BASE: &str = "https://api.openai.com/v1";

/// Helper function to detect audio format from base64 data URL
fn detect_audio_format(base64_data: &str) -> Result<(&str, Vec<u8>), String> {
    if let Some(data_part) = base64_data.strip_prefix("data:audio/wav;base64,") {
        let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data_part)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        Ok(("wav", bytes))
    } else if let Some(data_part) = base64_data.strip_prefix("data:audio/mp3;base64,") {
        let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data_part)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        Ok(("mp3", bytes))
    } else if let Some(data_part) = base64_data.strip_prefix("data:audio/mpeg;base64,") {
        let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data_part)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        Ok(("mp3", bytes))
    } else {
        Err("Unsupported audio format. Only WAV and MP3 are supported.".to_string())
    }
}

/// Transcribe audio using OpenAI Whisper (simple transcription)
#[tauri::command]
pub async fn openai_transcribe_audio(
    app: tauri::AppHandle,
    audio_base64: String,
) -> Result<String, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("openai_api_key") {
        Some(value) => value
            .as_str()
            .ok_or("OpenAI API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => {
            return Err("OpenAI API key not set. Please add your API key in Settings.".to_string())
        }
    };

    let (format, audio_bytes) = detect_audio_format(&audio_base64)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(1200)) // 20 min total timeout (audio analysis can be slow)
        .connect_timeout(Duration::from_secs(30)) // 30 sec to establish connection
        .read_timeout(Duration::from_secs(900)) // 15 min to read response
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Create multipart form for Whisper API
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(audio_bytes)
                .file_name(format!("audio.{}", format))
                .mime_str(&format!(
                    "audio/{}",
                    if format == "mp3" { "mpeg" } else { format }
                ))
                .map_err(|e| format!("Failed to set mime type: {}", e))?,
        )
        .text("model", "whisper-1")
        .text("language", "en");

    let response = client
        .post(&format!("{}/audio/transcriptions", OPENAI_API_BASE))
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("Invalid OpenAI API key. Please check your key in Settings.".to_string());
    } else if status.as_u16() == 429 {
        return Err("OpenAI rate limit exceeded. Please try again later.".to_string());
    } else if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
    }

    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let mut transcription = json_response["text"]
        .as_str()
        .ok_or("No transcription in response")?
        .to_string();

    // Filter out common Whisper hallucination
    if transcription.trim() == "Thanks for watching!" {
        transcription = String::new();
    }

    Ok(transcription)
}

/// Transcribe audio with word-level timestamps using OpenAI Whisper
#[tauri::command]
pub async fn openai_transcribe_audio_with_timestamps(
    app: tauri::AppHandle,
    audio_base64: String,
) -> Result<WhisperTranscriptionResponse, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("openai_api_key") {
        Some(value) => value
            .as_str()
            .ok_or("OpenAI API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => {
            return Err("OpenAI API key not set. Please add your API key in Settings.".to_string())
        }
    };

    let (format, audio_bytes) = detect_audio_format(&audio_base64)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(1200)) // 20 min total timeout (audio analysis can be slow)
        .connect_timeout(Duration::from_secs(30)) // 30 sec to establish connection
        .read_timeout(Duration::from_secs(900)) // 15 min to read response
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Create multipart form for Whisper API with verbose JSON and word timestamps
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(audio_bytes)
                .file_name(format!("audio.{}", format))
                .mime_str(&format!(
                    "audio/{}",
                    if format == "mp3" { "mpeg" } else { format }
                ))
                .map_err(|e| format!("Failed to set mime type: {}", e))?,
        )
        .text("model", "whisper-1")
        .text("language", "en")
        .text("response_format", "verbose_json")
        .text("timestamp_granularities[]", "word");

    let response = client
        .post(&format!("{}/audio/transcriptions", OPENAI_API_BASE))
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("Invalid OpenAI API key. Please check your key in Settings.".to_string());
    } else if status.as_u16() == 429 {
        return Err("OpenAI rate limit exceeded. Please try again later.".to_string());
    } else if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
    }

    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let text = json_response["text"]
        .as_str()
        .ok_or("No transcription in response")?
        .to_string();

    let words: Vec<WhisperWord> = json_response["words"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|w| {
                    Some(WhisperWord {
                        word: w["word"].as_str()?.to_string(),
                        start: w["start"].as_f64()?,
                        end: w["end"].as_f64()?,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(WhisperTranscriptionResponse {
        text,
        words: Some(words),
    })
}

/// Analyze full audio using GPT-4o-audio-preview with insights
#[tauri::command]
pub async fn openai_analyze_full_audio(
    app: tauri::AppHandle,
    audio_base64: String,
    context: AudioAnalysisContext,
) -> Result<AudioAnalysisResponse, String> {
    let store = app
        .store("api_keys.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let api_key = match store.get("openai_api_key") {
        Some(value) => value
            .as_str()
            .ok_or("OpenAI API key not set. Please add your API key in Settings.")?
            .to_string(),
        None => {
            return Err("OpenAI API key not set. Please add your API key in Settings.".to_string())
        }
    };

    let (format, _audio_bytes) = detect_audio_format(&audio_base64)?;

    // Extract base64 data without the data URL prefix
    let base64_data = if let Some(data) = audio_base64.strip_prefix(&format!(
        "data:audio/{};base64,",
        if format == "mp3" { "mpeg" } else { format }
    )) {
        data
    } else if let Some(data) = audio_base64.strip_prefix(&format!("data:audio/{};base64,", format))
    {
        data
    } else {
        return Err("Invalid base64 audio data format".to_string());
    };

    // Build context string for the prompt
    let context_str = format!(
        "Session: {} | Duration: {:.1} min | {} screenshots | {} audio segments",
        context.session_name.as_deref().unwrap_or("Work Session"),
        context.duration.unwrap_or(0.0) / 60.0,
        context.screenshot_count.unwrap_or(0),
        context.segment_count.unwrap_or(0)
    );

    // System message to clarify intent and avoid safety triggers
    let system_message = "You are an audio analysis assistant that transcribes speech and provides insights about work sessions. \
        Focus on content, emotional tone, and patterns. Do not attempt to identify speakers by name or personal characteristics.";

    // Create simplified prompt for GPT-4o-audio-preview (avoid safety triggers)
    let prompt = format!(
        r#"{}\n\nPlease transcribe this audio and analyze it. Return ONLY a JSON object with this exact structure:\n\n{{\n  "transcription": "complete word-for-word transcription of all speech",\n  "insights": {{\n    "narrative": "brief narrative summary of what occurred during the session",\n    "emotionalJourney": ["emotional shifts observed in the speech"],\n    "keyMoments": [\n      {{\n        "timestamp": 0,\n        "type": "achievement",\n        "description": "what happened",\n        "context": "surrounding context",\n        "excerpt": "brief quote if applicable"\n      }}\n    ],\n    "workPatterns": {{\n      "focusLevel": "low",\n      "interruptions": 0,\n      "flowStates": [{{"start": 0, "end": 0, "description": "focused period"}}]\n    }},\n    "environmentalContext": {{\n      "ambientNoise": "description of background sounds",\n      "workSetting": "description of environment",\n      "timeOfDay": "estimated time based on context"\n    }}\n  }}\n}}"#,
        context_str
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(1200)) // 20 min total timeout (audio analysis can be slow)
        .connect_timeout(Duration::from_secs(30)) // 30 sec to establish connection
        .read_timeout(Duration::from_secs(900)) // 15 min to read response
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Build request for GPT-4o-audio-preview (using latest version)
    let request_body = json!({
        "model": "gpt-4o-audio-preview-2025-06-03",
        "modalities": ["text"],
        "max_tokens": 16384, // GPT-4o-audio-preview max output limit (2025)
        "messages": [
            {
                "role": "system",
                "content": system_message
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": base64_data,
                            "format": format
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ],
        "temperature": 0.3
    });

    let response = client
        .post(&format!("{}/chat/completions", OPENAI_API_BASE))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("Invalid OpenAI API key. Please check your key in Settings.".to_string());
    } else if status.as_u16() == 429 {
        return Err("OpenAI rate limit exceeded. Please try again later.".to_string());
    } else if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
    }

    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content_text = json_response["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No content in response")?;

    // Parse the JSON response from the model
    let parsed: AudioAnalysisResponse = serde_json::from_str(content_text).map_err(|e| {
        format!(
            "Failed to parse AI response as JSON: {}. Content: {}",
            e, content_text
        )
    })?;

    Ok(parsed)
}
