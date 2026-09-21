mod caption;
mod db;
mod sync;
mod telegram;
mod vault;

use crate::telegram::StorageTarget;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub api_id: Option<i32>,
    pub api_hash: Option<String>,
    pub vault_path: Option<String>,
    pub storage: StorageTarget,
    pub theme: String,
}

impl AppConfig {
    fn load(path: &std::path::Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| AppConfig {
                theme: "dark".into(),
                ..Default::default()
            })
    }

    fn save(&self, path: &std::path::Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    }
}

pub struct Paths {
    pub app_data: PathBuf,
    pub config: PathBuf,
    pub db: PathBuf,
    pub session: PathBuf,
}

pub struct AppState {
    pub paths: Paths,
    pub config: Mutex<AppConfig>,
    pub telegram: telegram::SharedTg,
}

fn vault_root(state: &AppState) -> PathBuf {
    let cfg = state.config.lock().unwrap();
    cfg.vault_path
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| state.paths.app_data.join("vault"))
}

fn ensure_vault(state: &AppState) -> Result<PathBuf, String> {
    let root = vault_root(state);
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    vault::default_welcome(&root)?;
    Ok(root)
}

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(state: State<AppState>, config: AppConfig) -> Result<AppConfig, String> {
    config.save(&state.paths.config)?;
    *state.config.lock().unwrap() = config.clone();
    Ok(config)
}

#[tauri::command]
fn read_vault_tree(state: State<AppState>) -> Result<vault::VaultEntry, String> {
    let root = ensure_vault(&state)?;
    vault::build_tree(&root)
}

#[tauri::command]
fn read_note_file(state: State<AppState>, relative_path: String) -> Result<String, String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    vault::read_note(&path)
}

#[tauri::command]
fn write_note_file(
    app: AppHandle,
    state: State<AppState>,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    vault::write_note(&path, &content)?;
    let db_path = state.paths.db.clone();
    let telegram = state.telegram.clone();
    let storage = state.config.lock().unwrap().storage.clone();
    tauri::async_runtime::spawn(async move {
        let _ = sync::mark_dirty(&db_path, &root, &relative_path).await;
        if let Some(rt) = telegram.lock().await.as_ref() {
            let _ = sync::push_dirty(&app, rt, &storage, &root, &db_path).await;
        }
    });
    Ok(())
}

#[tauri::command]
fn create_note_file(
    state: State<AppState>,
    relative_path: String,
    content: Option<String>,
) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    if path.exists() {
        return Err("File already exists".into());
    }
    vault::write_note(&path, &content.unwrap_or_default())?;
    let db_path = state.paths.db.clone();
    let rel = relative_path.clone();
    let root2 = root.clone();
    tauri::async_runtime::spawn(async move {
        let _ = sync::mark_dirty(&db_path, &root2, &rel).await;
    });
    Ok(())
}

#[tauri::command]
fn create_vault_dir(state: State<AppState>, relative_path: String) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_vault_path(
    state: State<AppState>,
    old_relative: String,
    new_relative: String,
) -> Result<(), String> {
    let root = vault_root(&state);
    let old = vault::abs_in_vault(&root, &old_relative)?;
    let new = vault::abs_in_vault(&root, &new_relative)?;
    vault::rename_path(&old, &new)?;
    let conn = db::open(&state.paths.db)?;
    if let Some(mut row) = db::get(&conn, &old_relative)? {
        db::remove(&conn, &old_relative)?;
        row.path = new_relative.clone();
        row.dirty = true;
        db::upsert(&conn, &row)?;
    }
    Ok(())
}

#[tauri::command]
fn delete_vault_path(app: AppHandle, state: State<AppState>, relative_path: String) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    vault::delete_path(&path)?;
    let db_path = state.paths.db.clone();
    let telegram = state.telegram.clone();
    let storage = state.config.lock().unwrap().storage.clone();
    tauri::async_runtime::spawn(async move {
        let _ = sync::mark_deleted(&db_path, &relative_path).await;
        if let Some(rt) = telegram.lock().await.as_ref() {
            let _ = sync::push_dirty(&app, rt, &storage, &root, &db_path).await;
        }
    });
    Ok(())
}

fn reveal_path(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let native = path.to_string_lossy().replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(format!("/select,{native}"))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let parent = path.parent().unwrap_or(path);
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn open_path(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let native = path.to_string_lossy().replace('/', "\\");
        std::process::Command::new("cmd")
            .arg("/C")
            .arg(format!("start \"\" \"{native}\""))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn reveal_in_os(state: State<AppState>, relative_path: String) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    if !path.exists() {
        return Err("path not found".into());
    }
    reveal_path(&path)
}

#[tauri::command]
fn open_in_os(state: State<AppState>, relative_path: String) -> Result<(), String> {
    let root = vault_root(&state);
    let path = vault::abs_in_vault(&root, &relative_path)?;
    if !path.exists() {
        return Err("path not found".into());
    }
    open_path(&path)
}

#[tauri::command]
fn pick_vault_folder(state: State<AppState>, path: String) -> Result<AppConfig, String> {
    let mut cfg = state.config.lock().unwrap().clone();
    cfg.vault_path = Some(path);
    cfg.save(&state.paths.config)?;
    *state.config.lock().unwrap() = cfg.clone();
    Ok(cfg)
}

#[derive(Serialize)]
struct AuthStatus {
    configured: bool,
    authorized: bool,
    name: Option<String>,
}

#[tauri::command]
async fn tg_status(state: State<'_, AppState>) -> Result<AuthStatus, String> {
    let cfg = state.config.lock().unwrap().clone();
    let configured = cfg.api_id.is_some() && cfg.api_hash.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    let guard = state.telegram.lock().await;
    if let Some(rt) = guard.as_ref() {
        let authorized = telegram::is_authorized(rt).await.unwrap_or(false);
        let name = if authorized {
            telegram::me_name(rt).await.ok().flatten()
        } else {
            None
        };
        return Ok(AuthStatus {
            configured,
            authorized,
            name,
        });
    }
    Ok(AuthStatus {
        configured,
        authorized: false,
        name: None,
    })
}

async fn ensure_runtime(state: &AppState) -> Result<(), String> {
    let cfg = state.config.lock().unwrap().clone();
    let api_id = cfg.api_id.ok_or_else(|| {
        "Set api_id from my.telegram.org in Settings before connecting.".to_string()
    })?;
    let mut guard = state.telegram.lock().await;
    if guard.is_none() {
        let rt = telegram::connect(&state.paths.session, api_id).await?;
        *guard = Some(rt);
    }
    Ok(())
}

#[tauri::command]
async fn tg_connect(state: State<'_, AppState>) -> Result<AuthStatus, String> {
    ensure_runtime(&state).await?;
    tg_status(state).await
}

#[tauri::command]
async fn tg_request_code(state: State<'_, AppState>, phone: String) -> Result<(), String> {
    ensure_runtime(&state).await?;
    let hash = state
        .config
        .lock()
        .unwrap()
        .api_hash
        .clone()
        .ok_or_else(|| "api_hash missing".to_string())?;
    let mut guard = state.telegram.lock().await;
    let rt = guard.as_mut().ok_or("not connected")?;
    telegram::request_code(rt, &phone, &hash).await
}

#[tauri::command]
async fn tg_sign_in(state: State<'_, AppState>, code: String) -> Result<telegram::SignInResult, String> {
    let mut guard = state.telegram.lock().await;
    let rt = guard.as_mut().ok_or("not connected")?;
    telegram::sign_in_code(rt, &code).await
}

#[tauri::command]
async fn tg_check_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<telegram::SignInResult, String> {
    let mut guard = state.telegram.lock().await;
    let rt = guard.as_mut().ok_or("not connected")?;
    telegram::sign_in_password(rt, &password).await
}

#[tauri::command]
async fn tg_list_chats(state: State<'_, AppState>) -> Result<Vec<telegram::ChatOption>, String> {
    let guard = state.telegram.lock().await;
    let rt = guard.as_ref().ok_or("not connected")?;
    telegram::list_chats(rt).await
}

#[tauri::command]
async fn tg_set_storage(
    state: State<'_, AppState>,
    storage: StorageTarget,
) -> Result<AppConfig, String> {
    let mut cfg = state.config.lock().unwrap().clone();
    cfg.storage = storage;
    cfg.save(&state.paths.config)?;
    *state.config.lock().unwrap() = cfg.clone();
    Ok(cfg)
}

#[tauri::command]
async fn tg_sync_now(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let cfg = state.config.lock().unwrap().clone();
    let root = vault_root(&state);
    let db_path = state.paths.db.clone();
    let guard = state.telegram.lock().await;
    let rt = guard.as_ref().ok_or("not connected")?;
    if !telegram::is_authorized(rt).await? {
        return Err("sign in first".into());
    }
    sync::full_sync(&app, rt, &cfg.storage, &root, &db_path).await
}

#[tauri::command]
async fn tg_start_updates(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    ensure_runtime(&state).await?;
    let cfg = state.config.lock().unwrap().clone();
    let root = vault_root(&state);
    let db_path = state.paths.db.clone();
    let allow_inbox = matches!(cfg.storage, StorageTarget::Chat { .. });
    let mut guard = state.telegram.lock().await;
    let rt = guard.as_mut().ok_or("not connected")?;
    if !telegram::is_authorized(rt).await? {
        return Err("sign in first".into());
    }
    let Some(updates) = rt.updates.take() else {
        return Ok(());
    };
    telegram::spawn_updates(
        app,
        rt.client.clone(),
        updates,
        cfg.storage,
        root,
        db_path,
        allow_inbox,
    );
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let app_data = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from(".quanta-data"));
            std::fs::create_dir_all(&app_data).ok();
            let paths = Paths {
                config: app_data.join("config.json"),
                db: app_data.join("quanta.db"),
                session: app_data.join("telegram.session"),
                app_data: app_data.clone(),
            };
            let config = AppConfig::load(&paths.config);
            let _ = db::open(&paths.db);
            let vault = config
                .vault_path
                .as_ref()
                .map(PathBuf::from)
                .unwrap_or_else(|| app_data.join("vault"));
            let _ = std::fs::create_dir_all(&vault);
            let _ = vault::default_welcome(&vault);
            app.manage(AppState {
                paths,
                config: Mutex::new(config),
                telegram: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            read_vault_tree,
            read_note_file,
            write_note_file,
            create_note_file,
            create_vault_dir,
            rename_vault_path,
            delete_vault_path,
            pick_vault_folder,
            reveal_in_os,
            open_in_os,
            tg_status,
            tg_connect,
            tg_request_code,
            tg_sign_in,
            tg_check_password,
            tg_list_chats,
            tg_set_storage,
            tg_sync_now,
            tg_start_updates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
