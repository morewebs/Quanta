use std::fs;
use std::path::Path;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
}

fn build_vault_tree(root: &Path, current: &Path) -> Result<VaultEntry, String> {
    let metadata = fs::metadata(current).map_err(|e| e.to_string())?;
    let name = current
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let relative_path = current
        .strip_prefix(root)
        .unwrap_or(current)
        .to_string_lossy()
        .replace('\\', "/");
    let full_path = current.to_string_lossy().replace('\\', "/");

    if metadata.is_dir() {
        let mut children = Vec::new();
        if let Ok(entries) = fs::read_dir(current) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                // Skip hidden files, .git, node_modules, target, etc.
                if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                    continue;
                }

                if path.is_dir() {
                    if let Ok(child_tree) = build_vault_tree(root, &path) {
                        children.push(child_tree);
                    }
                } else if file_name.ends_with(".md") {
                    let child_rel = path
                        .strip_prefix(root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");
                    children.push(VaultEntry {
                        name: file_name,
                        path: path.to_string_lossy().replace('\\', "/"),
                        relative_path: child_rel,
                        is_dir: false,
                        children: None,
                    });
                }
            }
        }

        // Sort: directories first (alphabetical), then files (alphabetical)
        children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(VaultEntry {
            name,
            path: full_path,
            relative_path,
            is_dir: true,
            children: Some(children),
        })
    } else {
        Ok(VaultEntry {
            name,
            path: full_path,
            relative_path,
            is_dir: false,
            children: None,
        })
    }
}

#[tauri::command]
fn read_vault_tree(vault_path: String) -> Result<VaultEntry, String> {
    let path = Path::new(&vault_path);
    if !path.exists() || !path.is_dir() {
        return Err("Vault path does not exist or is not a directory".into());
    }
    build_vault_tree(path, path)
}

#[tauri::command]
fn read_note_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_note_file(file_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_note_file(file_path: String, content: Option<String>) -> Result<(), String> {
    let path = Path::new(&file_path);
    if path.exists() {
        return Err("File already exists".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_vault_dir(dir_path: String) -> Result<(), String> {
    let path = Path::new(&dir_path);
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_vault_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_vault_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_vault_tree,
            read_note_file,
            write_note_file,
            create_note_file,
            create_vault_dir,
            rename_vault_path,
            delete_vault_path
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
