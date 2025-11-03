/**
 * Session Query API - Tauri Commands for External Tool Integration
 *
 * Provides Tauri IPC commands for querying session data from external tools
 * (Alfred workflows, VS Code extensions, Obsidian plugins, etc.)
 *
 * ARCHITECTURE:
 * - External tools invoke these commands via Tauri IPC
 * - Commands load session data from storage
 * - Returns structured data for external processing
 * - No AI processing in Rust (AI handled in TypeScript or by external tool)
 *
 * COMMANDS:
 * 1. query_active_session() - Get currently active session
 * 2. query_sessions() - Search/filter across all sessions
 * 3. get_session_by_id() - Load specific session detail
 *
 * USAGE (from external JavaScript):
 * ```javascript
 * const { invoke } = require('@tauri-apps/api/core');
 *
 * // Get active session
 * const activeSession = await invoke('query_active_session');
 *
 * // Query sessions
 * const results = await invoke('query_sessions', {
 *   filters: { hasBlockers: true, activity: 'coding' }
 * });
 * ```
 */

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Query filters for searching sessions
 *
 * All fields are optional - empty query returns recent sessions
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionQueryFilters {
    /// Filter by activity type (coding, meetings, research, etc.)
    pub activity: Option<Vec<String>>,

    /// Search keywords in session name, description, tags
    pub keywords: Option<Vec<String>>,

    /// Filter sessions with blockers
    pub has_blockers: Option<bool>,

    /// Filter sessions with achievements
    pub has_achievements: Option<bool>,

    /// Filter by date range (ISO 8601 strings)
    pub start_date: Option<String>,
    pub end_date: Option<String>,

    /// Limit number of results
    pub limit: Option<usize>,

    /// Filter by session status
    pub status: Option<String>, // 'active', 'paused', 'completed'
}

/**
 * Query result structure
 *
 * Contains filtered sessions and metadata about the query
 * Uses JsonValue for maximum flexibility with session data
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionQueryResult {
    /// Matching sessions (as JSON for flexibility)
    pub sessions: Vec<JsonValue>,

    /// Total number of matches
    pub total: usize,

    /// Query execution time in milliseconds
    pub elapsed_ms: u64,

    /// Error message if query failed
    pub error: Option<String>,
}

/**
 * Active session state manager
 *
 * Tracks the currently active session ID across the application
 * Thread-safe with Arc<Mutex<>>
 */
pub struct ActiveSessionState {
    active_session_id: Arc<Mutex<Option<String>>>,
}

impl ActiveSessionState {
    pub fn new() -> Self {
        Self {
            active_session_id: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_active(&self, session_id: Option<String>) {
        if let Ok(mut active) = self.active_session_id.lock() {
            *active = session_id;
        }
    }

    pub fn get_active(&self) -> Option<String> {
        if let Ok(active) = self.active_session_id.lock() {
            active.clone()
        } else {
            None
        }
    }
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/**
 * Query the currently active session
 *
 * Returns the full session object for the active session, or null if no active session.
 * Active session is tracked via ActiveSessionState.
 *
 * USAGE:
 * ```javascript
 * const session = await invoke('query_active_session');
 * if (session) {
 *   console.log(`Active session: ${session.name}`);
 * }
 * ```
 *
 * RETURNS:
 * - Ok(Some(Session)) if active session exists
 * - Ok(None) if no active session
 * - Err(String) if loading failed
 */
#[tauri::command]
pub async fn query_active_session(
    app_handle: AppHandle,
    state: State<'_, ActiveSessionState>,
) -> Result<Option<JsonValue>, String> {
    println!("🔍 [QUERY API] query_active_session called");

    // Get active session ID from state
    let active_id = state.get_active();

    if let Some(session_id) = active_id {
        println!("📍 [QUERY API] Active session ID: {}", session_id);

        // Load full session data
        match load_session_by_id(&session_id, &app_handle).await {
            Ok(session) => Ok(Some(session)),
            Err(e) => {
                eprintln!("❌ [QUERY API] Failed to load active session: {}", e);
                Err(format!("Failed to load active session: {}", e))
            }
        }
    } else {
        println!("ℹ️  [QUERY API] No active session");
        Ok(None)
    }
}

/**
 * Query sessions with optional filters
 *
 * Searches across all sessions and returns matching results.
 * All filters are optional - empty query returns recent sessions.
 *
 * USAGE:
 * ```javascript
 * // Get recent sessions (no filters)
 * const recent = await invoke('query_sessions', { filters: {} });
 *
 * // Find sessions with blockers
 * const blocked = await invoke('query_sessions', {
 *   filters: { hasBlockers: true }
 * });
 *
 * // Search by activity and keywords
 * const coding = await invoke('query_sessions', {
 *   filters: {
 *     activity: ['coding'],
 *     keywords: ['authentication', 'bug']
 *   }
 * });
 * ```
 *
 * RETURNS:
 * - Ok(SessionQueryResult) with matching sessions
 * - Err(String) if query failed
 */
#[tauri::command]
pub async fn query_sessions(
    filters: SessionQueryFilters,
    app_handle: AppHandle,
) -> Result<SessionQueryResult, String> {
    println!("🔍 [QUERY API] query_sessions called with filters: {:?}", filters);
    let start = std::time::Instant::now();

    // Load all sessions from storage
    let sessions = match load_all_sessions(&app_handle).await {
        Ok(s) => s,
        Err(e) => {
            return Ok(SessionQueryResult {
                sessions: vec![],
                total: 0,
                elapsed_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Failed to load sessions: {}", e)),
            });
        }
    };

    println!("📦 [QUERY API] Loaded {} total sessions", sessions.len());

    // Apply filters
    let filtered_sessions = apply_filters(sessions, &filters);

    let elapsed_ms = start.elapsed().as_millis() as u64;
    println!(
        "✅ [QUERY API] Found {} matching sessions in {}ms",
        filtered_sessions.len(),
        elapsed_ms
    );

    Ok(SessionQueryResult {
        total: filtered_sessions.len(),
        sessions: filtered_sessions,
        elapsed_ms,
        error: None,
    })
}

/**
 * Get a specific session by ID
 *
 * Loads full session detail including all screenshots, audio, and metadata.
 *
 * USAGE:
 * ```javascript
 * const session = await invoke('get_session_by_id', {
 *   sessionId: 'session-123'
 * });
 * console.log(`Session: ${session.name}`);
 * ```
 *
 * RETURNS:
 * - Ok(Session) if session found
 * - Err(String) if session not found or loading failed
 */
#[tauri::command]
pub async fn get_session_by_id(
    session_id: String,
    app_handle: AppHandle,
) -> Result<JsonValue, String> {
    println!("🔍 [QUERY API] get_session_by_id: {}", session_id);

    load_session_by_id(&session_id, &app_handle).await
}

/**
 * Set the active session ID
 *
 * Called from TypeScript when a session starts or ends.
 * Allows external tools to query the active session.
 *
 * USAGE (from TypeScript):
 * ```typescript
 * await invoke('set_active_session_id', { sessionId: 'session-123' });
 * await invoke('set_active_session_id', { sessionId: null }); // Clear active
 * ```
 */
#[tauri::command]
pub async fn set_active_session_id(
    session_id: Option<String>,
    state: State<'_, ActiveSessionState>,
) -> Result<(), String> {
    if let Some(id) = &session_id {
        println!("📍 [QUERY API] Setting active session: {}", id);
    } else {
        println!("📍 [QUERY API] Clearing active session");
    }

    state.set_active(session_id);
    Ok(())
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load all sessions from storage
 *
 * Reads sessions.json and parses into Vec<JsonValue> for flexibility
 */
async fn load_all_sessions(app_handle: &AppHandle) -> Result<Vec<JsonValue>, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let sessions_path = data_dir.join("sessions.json");

    if !sessions_path.exists() {
        return Ok(vec![]);
    }

    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    let sessions: Vec<JsonValue> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    Ok(sessions)
}

/**
 * Load a single session by ID
 *
 * Searches through all sessions and returns matching one
 */
async fn load_session_by_id(session_id: &str, app_handle: &AppHandle) -> Result<JsonValue, String> {
    let sessions = load_all_sessions(app_handle).await?;

    sessions
        .into_iter()
        .find(|s| s.get("id").and_then(|id| id.as_str()) == Some(session_id))
        .ok_or_else(|| format!("Session not found: {}", session_id))
}

/**
 * Apply filters to sessions
 *
 * Filters sessions based on provided criteria
 * Works with JSON for maximum flexibility
 * Returns filtered and sorted results
 */
fn apply_filters(sessions: Vec<JsonValue>, filters: &SessionQueryFilters) -> Vec<JsonValue> {
    let mut filtered: Vec<JsonValue> = sessions
        .into_iter()
        .filter(|session| {
            // Status filter
            if let Some(ref status) = filters.status {
                if let Some(session_status) = session.get("status").and_then(|v| v.as_str()) {
                    if session_status != status {
                        return false;
                    }
                } else {
                    return false; // No status field
                }
            }

            // Date range filter
            if let Some(ref start_date) = filters.start_date {
                if let Some(start_time) = session.get("startTime").and_then(|v| v.as_str()) {
                    if start_time < start_date.as_str() {
                        return false;
                    }
                } else {
                    return false; // No startTime field
                }
            }

            if let Some(ref end_date) = filters.end_date {
                if let Some(session_end) = session.get("endTime").and_then(|v| v.as_str()) {
                    if session_end > end_date.as_str() {
                        return false;
                    }
                }
            }

            // Keyword search (in name, description, tags)
            if let Some(ref keywords) = filters.keywords {
                let name = session
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();

                let description = session
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();

                let tags_str = session
                    .get("tags")
                    .and_then(|v| v.as_array())
                    .map(|tags| {
                        tags.iter()
                            .filter_map(|t| t.as_str())
                            .collect::<Vec<_>>()
                            .join(" ")
                            .to_lowercase()
                    })
                    .unwrap_or_default();

                let search_text = format!("{} {} {}", name, description, tags_str);

                let matches_keyword = keywords
                    .iter()
                    .any(|kw| search_text.contains(&kw.to_lowercase()));

                if !matches_keyword {
                    return false;
                }
            }

            // Activity filter (check screenshots for activity)
            if let Some(ref activities) = filters.activity {
                let screenshots = session
                    .get("screenshots")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.to_vec())
                    .unwrap_or_default();

                let has_activity = screenshots.iter().any(|screenshot| {
                    if let Some(analysis) = screenshot.get("aiAnalysis") {
                        if let Some(detected_activity) = analysis
                            .get("detectedActivity")
                            .and_then(|v| v.as_str())
                        {
                            return activities
                                .iter()
                                .any(|a| detected_activity.to_lowercase().contains(&a.to_lowercase()));
                        }
                    }
                    false
                });

                if !has_activity {
                    return false;
                }
            }

            // Blockers filter
            if let Some(has_blockers) = filters.has_blockers {
                let screenshots = session
                    .get("screenshots")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.to_vec())
                    .unwrap_or_default();

                let session_has_blockers = screenshots.iter().any(|screenshot| {
                    if let Some(analysis) = screenshot.get("aiAnalysis") {
                        if let Some(progress) = analysis.get("progressIndicators") {
                            if let Some(blockers) = progress.get("blockers").and_then(|v| v.as_array()) {
                                return !blockers.is_empty();
                            }
                        }
                    }
                    false
                });

                if has_blockers && !session_has_blockers {
                    return false;
                }
                if !has_blockers && session_has_blockers {
                    return false;
                }
            }

            // Achievements filter
            if let Some(has_achievements) = filters.has_achievements {
                let screenshots = session
                    .get("screenshots")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.to_vec())
                    .unwrap_or_default();

                let session_has_achievements = screenshots.iter().any(|screenshot| {
                    if let Some(analysis) = screenshot.get("aiAnalysis") {
                        if let Some(progress) = analysis.get("progressIndicators") {
                            if let Some(achievements) = progress.get("achievements").and_then(|v| v.as_array()) {
                                return !achievements.is_empty();
                            }
                        }
                    }
                    false
                });

                if has_achievements && !session_has_achievements {
                    return false;
                }
                if !has_achievements && session_has_achievements {
                    return false;
                }
            }

            true
        })
        .collect();

    // Sort by start time (newest first)
    filtered.sort_by(|a, b| {
        let a_time = a.get("startTime").and_then(|v| v.as_str()).unwrap_or("");
        let b_time = b.get("startTime").and_then(|v| v.as_str()).unwrap_or("");
        b_time.cmp(a_time)
    });

    // Apply limit
    if let Some(limit) = filters.limit {
        filtered.truncate(limit);
    }

    filtered
}
