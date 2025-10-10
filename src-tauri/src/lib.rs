use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use std::process::Command;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create system tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit Taskerino", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
            let capture_i = MenuItem::with_id(app, "capture", "Quick Capture (⌘⇧Space)", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&show_i, &hide_i, &capture_i, &quit_i],
            )?;

            // Build system tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "capture" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            // Emit event to frontend to open capture zone
                            let _ = app.emit("navigate-to-capture", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Register global shortcuts using the plugin
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

                // Register plugin
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if let Some(window) = app.get_webview_window("main") {
                                    // Cmd+Shift+Space for quick capture
                                    if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space) {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.set_focus();
                                            let _ = app.emit("navigate-to-capture", ());
                                        } else {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                            let _ = app.emit("navigate-to-capture", ());
                                        }
                                    }
                                    // Cmd+Shift+T to toggle window visibility
                                    else if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT) {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                    }
                                    // Cmd+Shift+4 for screenshot capture
                                    else if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit4) {
                                        // Generate unique temp filename
                                        let timestamp = std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs();
                                        let temp_path = std::env::temp_dir()
                                            .join(format!("taskerino_screenshot_{}.png", timestamp));

                                        // Use macOS screencapture with interactive selection
                                        let status = Command::new("screencapture")
                                            .arg("-i")  // Interactive selection
                                            .arg(&temp_path)
                                            .status();

                                        // If screenshot was taken, emit event to frontend
                                        if status.is_ok() && temp_path.exists() {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                            let _ = app.emit("screenshot-captured", temp_path.to_str().unwrap_or(""));
                                        }
                                    }
                                }
                            }
                        })
                        .build(),
                )?;

                // Register shortcuts
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space))?;
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT))?;
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit4))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
