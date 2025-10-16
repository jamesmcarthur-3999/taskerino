/**
 * Permissions utilities for macOS
 */

export async function checkScreenRecordingPermission(): Promise<boolean> {
  // On macOS, if we can successfully capture a screen, we have permission
  // The screenshots crate will fail if permission is not granted
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('capture_primary_screen');
    return true;
  } catch (error) {
    console.error('Screen recording permission check failed:', error);
    return false;
  }
}

export function showMacOSPermissionInstructions(): void {
  const message = `
🔒 Screen Recording Permission Required

Taskerino needs Screen Recording permission to capture screenshots in the background.

To enable:
1. Open System Settings (System Preferences on older macOS)
2. Go to Privacy & Security → Screen Recording
3. Enable Taskerino in the list
4. Restart Taskerino

This allows the app to capture screenshots even when you're working in other apps.
  `.trim();

  alert(message);
}
