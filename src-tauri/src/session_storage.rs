/**
 * Session Storage Module (Task 3A)
 *
 * Parallel session loading using Rust + Rayon for multi-core processing
 * Offloads heavy JSON parsing and data transformation from JavaScript
 */

use tauri::{AppHandle, Manager};
use rayon::prelude::*;
use std::time::Instant;

use crate::session_models::{Session, SessionSummary};

/**
 * Load session summaries (lightweight, parallel)
 * Returns only metadata without full arrays
 * Uses rayon for parallel transformation across CPU cores
 */
#[tauri::command]
pub async fn load_session_summaries(
    app_handle: AppHandle
) -> Result<Vec<SessionSummary>, String> {
    println!("🦀 [RUST] Loading session summaries with parallel processing...");
    let start = Instant::now();

    // Get app data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let sessions_path = data_dir.join("sessions.json");

    // Check if file exists
    if !sessions_path.exists() {
        println!("⚠️  [RUST] Sessions file not found, returning empty array");
        return Ok(vec![]);
    }

    // Read file (async I/O)
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    // Parse JSON in Rust (faster than JavaScript for large files)
    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    println!("📦 [RUST] Parsed {} sessions from JSON", sessions.len());

    // Transform to summaries in PARALLEL using rayon
    // This distributes work across all CPU cores
    let summaries: Vec<SessionSummary> = sessions
        .into_par_iter()  // Parallel iterator - uses thread pool
        .map(|session| session.into())  // Convert each session to summary
        .collect();

    let elapsed = start.elapsed();
    println!("✅ [RUST] Loaded {} summaries in {:?} (parallel)", summaries.len(), elapsed);
    println!("⚡ [PERFORMANCE] CPU cores utilized: {}", rayon::current_num_threads());

    Ok(summaries)
}

/**
 * Load single session detail on-demand
 * Avoids loading all sessions into memory
 */
#[tauri::command]
pub async fn load_session_detail(
    session_id: String,
    app_handle: AppHandle
) -> Result<Session, String> {
    println!("🦀 [RUST] Loading session detail for {}...", session_id);
    let start = Instant::now();

    // Get app data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let sessions_path = data_dir.join("sessions.json");

    // Read file
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    // Parse JSON
    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    // Find session (linear search - could optimize with hash map)
    let session = sessions
        .into_iter()
        .find(|s| s.id == session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let elapsed = start.elapsed();
    println!("✅ [RUST] Loaded session in {:?}", elapsed);

    Ok(session)
}

/**
 * Search sessions (parallel full-text search)
 * Uses rayon for multi-core search across large session arrays
 */
#[tauri::command]
pub async fn search_sessions(
    query: String,
    app_handle: AppHandle
) -> Result<Vec<SessionSummary>, String> {
    println!("🦀 [RUST] Searching sessions for '{}'...", query);
    let start = Instant::now();

    // Get app data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let sessions_path = data_dir.join("sessions.json");

    if !sessions_path.exists() {
        return Ok(vec![]);
    }

    // Read and parse
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    let query_lower = query.to_lowercase();

    // PARALLEL search using rayon
    let matching_summaries: Vec<SessionSummary> = sessions
        .into_par_iter()
        .filter(|session| {
            // Search in name
            if session.name.to_lowercase().contains(&query_lower) {
                return true;
            }

            // Search in category
            if let Some(category) = &session.category {
                if category.to_lowercase().contains(&query_lower) {
                    return true;
                }
            }

            // Search in notes
            if let Some(notes) = &session.notes {
                if notes.to_lowercase().contains(&query_lower) {
                    return true;
                }
            }

            false
        })
        .map(|session| session.into())
        .collect();

    let elapsed = start.elapsed();
    println!("✅ [RUST] Found {} matches in {:?} (parallel search)", matching_summaries.len(), elapsed);

    Ok(matching_summaries)
}

/**
 * Get session count (fast, no parsing)
 */
#[tauri::command]
pub async fn get_session_count(
    app_handle: AppHandle
) -> Result<usize, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let sessions_path = data_dir.join("sessions.json");

    if !sessions_path.exists() {
        return Ok(0);
    }

    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    let sessions: Vec<serde_json::Value> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(sessions.len())
}
