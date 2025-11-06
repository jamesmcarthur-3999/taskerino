use serde::{Deserialize, Serialize};

// ============================================================================
// OpenAI Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct WhisperWord {
    pub word: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WhisperTranscriptionResponse {
    pub text: String,
    pub words: Option<Vec<WhisperWord>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioAnalysisContext {
    pub session_name: Option<String>,
    pub session_description: Option<String>,
    pub duration: Option<f64>,
    pub screenshot_count: Option<usize>,
    pub segment_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInsights {
    pub narrative: String,
    pub emotional_journey: Vec<String>,
    pub key_moments: Vec<KeyMoment>,
    pub work_patterns: WorkPatterns,
    pub environmental_context: EnvironmentalContext,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyMoment {
    pub timestamp: f64,
    #[serde(rename = "type")]
    pub moment_type: String,
    pub description: String,
    pub context: String,
    pub excerpt: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkPatterns {
    pub focus_level: String,
    pub interruptions: i32,
    pub flow_states: Vec<FlowState>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowState {
    pub start: f64,
    pub end: f64,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentalContext {
    pub ambient_noise: String,
    pub work_setting: String,
    pub time_of_day: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioAnalysisResponse {
    pub transcription: String,
    pub insights: AudioInsights,
}

// ============================================================================
// Claude Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: ClaudeMessageContent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum ClaudeMessageContent {
    Text(String),
    Blocks(Vec<ClaudeContentBlock>),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ClaudeContentBlock {
    #[serde(rename = "text")]
    Text {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<serde_json::Value>,
    },
    #[serde(rename = "image")]
    Image {
        source: ClaudeImageSource,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<serde_json::Value>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeImageSource {
    #[serde(rename = "type")]
    pub source_type: String, // "base64"

    #[serde(alias = "mediaType")] // Accept camelCase from TypeScript
    pub media_type: String, // "image/jpeg", "image/png", etc. - serializes as snake_case for Claude API

    pub data: String, // base64 encoded image
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeTool {
    pub name: String,
    pub description: String,
    #[serde(rename = "input_schema", alias = "inputSchema")]
    pub input_schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_control: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeChatRequest {
    pub model: String,
    pub max_tokens: u32,
    pub messages: Vec<ClaudeMessage>,
    pub system: Option<serde_json::Value>, // Accepts both String and Array with cache_control
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ClaudeTool>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeChatResponse {
    pub id: String,
    pub content: Vec<ClaudeResponseContent>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub usage: ClaudeUsage,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeResponseContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    // Prompt caching fields (optional, only present when using cache)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_creation_input_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_input_tokens: Option<u32>,
}

// ============================================================================
// Claude Streaming Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStreamingRequest {
    pub model: String,
    pub max_tokens: u32,
    pub messages: Vec<ClaudeMessage>,
    pub system: Option<serde_json::Value>, // Accepts both String and Array with cache_control
    pub temperature: Option<f32>,
    pub tools: Option<Vec<ClaudeTool>>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extended_thinking: Option<bool>,
}

// ============================================================================
// Tauri Provider Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum TauriProviderType {
    Anthropic,
    Openai,
    Google,
    Ollama,
}

// Tauri chat completion request - wraps baleybots ChatCompletionParams
// The params are sent as JSON from TypeScript, so we use serde_json::Value
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TauriChatCompletionRequest {
    pub provider_type: TauriProviderType,
    pub model: String,
    // ChatCompletionParams from baleybots - sent as JSON
    pub params: serde_json::Value,
    // ProviderConfig from baleybots - sent as JSON (API key will be injected from Tauri store)
    pub config: serde_json::Value,
}

// Tauri stream event payload - wraps baleybots StreamEvent
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TauriStreamEventPayload {
    pub stream_id: String,
    // StreamEvent from baleybots - sent as JSON
    pub event: serde_json::Value,
}

// Tauri stream start response
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriStreamStartResponse {
    pub stream_id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
