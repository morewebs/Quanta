use crate::caption::normalize_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
}

pub fn default_welcome(vault: &Path) -> Result<(), String> {
    let welcome = vault.join("Welcome.md");
    if welcome.exists() {
        return Ok(());
    }
    fs::create_dir_all(vault).map_err(|e| e.to_string())?;
    fs::write(
        welcome,
        r#"# Welcome to Quanta

A local-first notes app. Telegram is the cloud — Saved Messages by default, or any private chat you pick.

## Live preview

Write **bold**, *italic*, and `code`. Markers hide when the cursor leaves them.

- [ ] Open a note with Ctrl+K
- [ ] Link to [[Architecture]]
- [x] Start writing

## Wikilinks

- [[Architecture]]
- [[Architecture#Editor|the editor]]
- Click a missing link to create it.
"#,
    )
    .map_err(|e| e.to_string())?;

    let arch = vault.join("Architecture.md");
    if !arch.exists() {
        fs::write(
            arch,
            r#"# Architecture

Quanta keeps markdown on disk and replicas each note as a Telegram document.

## Editor

CodeMirror 6 live preview. Source stays `.md`.

## Cloud

A `quanta/v1` caption namespaces notes so Saved Messages stays usable as storage.
"#,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn build_tree(root: &Path) -> Result<VaultEntry, String> {
    if !root.exists() {
        fs::create_dir_all(root).map_err(|e| e.to_string())?;
    }
    walk(root, root)
}

fn walk(root: &Path, current: &Path) -> Result<VaultEntry, String> {
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

    if !metadata.is_dir() {
        return Ok(VaultEntry {
            name,
            path: full_path,
            relative_path,
            is_dir: false,
            children: None,
        });
    }

    let mut children = Vec::new();
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                continue;
            }
            if path.is_dir() {
                if let Ok(child) = walk(root, &path) {
                    children.push(child);
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

    children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(VaultEntry {
        name: if relative_path.is_empty() {
            root.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Vault")
                .to_string()
        } else {
            name
        },
        path: full_path,
        relative_path,
        is_dir: true,
        children: Some(children),
    })
}

pub fn abs_in_vault(vault: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = normalize_path(relative);
    if rel.is_empty() || rel.contains("..") {
        return Err("invalid path".into());
    }
    Ok(vault.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)))
}

pub fn relative_from(vault: &Path, abs: &Path) -> String {
    abs.strip_prefix(vault)
        .unwrap_or(abs)
        .to_string_lossy()
        .replace('\\', "/")
}

pub fn list_markdown(vault: &Path) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    collect_md(vault, vault, &mut out)?;
    out.sort();
    Ok(out)
}

fn collect_md(root: &Path, current: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_md(root, &path, out)?;
        } else if name.ends_with(".md") {
            out.push(relative_from(root, &path));
        }
    }
    Ok(())
}

pub fn write_note(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn read_note(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn delete_path(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

pub fn rename_path(old: &Path, new: &Path) -> Result<(), String> {
    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(old, new).map_err(|e| e.to_string())
}
