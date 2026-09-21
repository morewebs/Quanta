use crate::caption::{content_hash, NoteMeta};
use crate::db::{self, NoteRow};
use crate::telegram::{self, StorageTarget, TgRuntime};
use crate::vault;
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub async fn mark_dirty(db_path: &Path, vault_root: &Path, relative: &str) -> Result<(), String> {
    let conn = db::open(db_path)?;
    let abs = vault::abs_in_vault(vault_root, relative)?;
    let bytes = std::fs::read(&abs).map_err(|e| e.to_string())?;
    let hash = content_hash(&bytes);
    let prev = db::get(&conn, relative)?;
    let rev = prev.as_ref().map(|r| r.rev).unwrap_or(0);
    db::upsert(
        &conn,
        &NoteRow {
            path: relative.to_string(),
            message_id: prev.and_then(|r| r.message_id),
            hash,
            rev,
            dirty: true,
            deleted: false,
        },
    )
}

pub async fn mark_deleted(db_path: &Path, relative: &str) -> Result<(), String> {
    let conn = db::open(db_path)?;
    let prev = db::get(&conn, relative)?;
    db::upsert(
        &conn,
        &NoteRow {
            path: relative.to_string(),
            message_id: prev.as_ref().and_then(|r| r.message_id),
            hash: prev.as_ref().map(|r| r.hash.clone()).unwrap_or_default(),
            rev: prev.as_ref().map(|r| r.rev).unwrap_or(0) + 1,
            dirty: true,
            deleted: true,
        },
    )
}

pub async fn push_dirty(
    app: &AppHandle,
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    db_path: &Path,
) -> Result<usize, String> {
    let (paths, deleted) = {
        let conn = db::open(db_path)?;
        let paths = db::dirty_paths(&conn)?;
        let deleted = db::all(&conn)?
            .into_iter()
            .filter(|r| r.dirty && r.deleted)
            .collect::<Vec<_>>();
        (paths, deleted)
    };
    let _ = app.emit(
        "sync-status",
        serde_json::json!({ "state": "syncing", "detail": format!("{} queued", paths.len() + deleted.len()) }),
    );

    let mut n = 0usize;
    for path in paths {
        n += push_one(rt, target, vault_root, db_path, &path).await?;
    }
    for row in deleted {
        n += push_tombstone(rt, target, vault_root, db_path, &row).await?;
    }
    let _ = app.emit(
        "sync-status",
        serde_json::json!({ "state": "idle", "detail": null }),
    );
    Ok(n)
}

async fn push_one(
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    db_path: &Path,
    relative: &str,
) -> Result<usize, String> {
    let conn = db::open(db_path)?;
    let row = db::get(&conn, relative)?.ok_or_else(|| "missing row".to_string())?;
    let abs = vault::abs_in_vault(vault_root, relative)?;
    if !abs.exists() {
        return Ok(0);
    }
    let bytes = std::fs::read(&abs).map_err(|e| e.to_string())?;
    let hash = content_hash(&bytes);
    let rev = row.rev + 1;
    let meta = NoteMeta {
        path: relative.to_string(),
        hash: hash.clone(),
        rev,
        deleted: false,
    };
    let message_id = telegram::push_note(rt, target, vault_root, relative, row.message_id, &meta)
        .await?;
    db::upsert(
        &conn,
        &NoteRow {
            path: relative.to_string(),
            message_id: Some(message_id),
            hash,
            rev,
            dirty: false,
            deleted: false,
        },
    )?;
    Ok(1)
}

async fn push_tombstone(
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    db_path: &Path,
    row: &NoteRow,
) -> Result<usize, String> {
    let meta = NoteMeta {
        path: row.path.clone(),
        hash: row.hash.clone(),
        rev: row.rev,
        deleted: true,
    };
    // ponytail: tiny placeholder file for tombstones; skip extra Telegram delete until needed
    let tmp = vault_root.join(".quanta-tombstone.md");
    std::fs::write(&tmp, "deleted\n").map_err(|e| e.to_string())?;
    let id = telegram::push_note(rt, target, vault_root, ".quanta-tombstone.md", row.message_id, &meta)
        .await;
    let _ = std::fs::remove_file(&tmp);
    let message_id = id?;
    let conn = db::open(db_path)?;
    db::upsert(
        &conn,
        &NoteRow {
            path: row.path.clone(),
            message_id: Some(message_id),
            hash: row.hash.clone(),
            rev: row.rev,
            dirty: false,
            deleted: true,
        },
    )?;
    Ok(1)
}

pub async fn full_sync(
    app: &AppHandle,
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    db_path: &Path,
) -> Result<(), String> {
    let _ = app.emit(
        "sync-status",
        serde_json::json!({ "state": "syncing", "detail": "scanning Telegram" }),
    );
    let allow_inbox = matches!(target, StorageTarget::Chat { .. });
    telegram::scan_remote(rt, target, vault_root, db_path, allow_inbox).await?;
    let conn = db::open(db_path)?;

    let local = vault::list_markdown(vault_root)?;
    for rel in local {
        if rel.starts_with('.') {
            continue;
        }
        let row = db::get(&conn, &rel)?;
        if row.is_none() {
            let abs = vault::abs_in_vault(vault_root, &rel)?;
            let hash = content_hash(&std::fs::read(abs).map_err(|e| e.to_string())?);
            db::upsert(
                &conn,
                &NoteRow {
                    path: rel,
                    message_id: None,
                    hash,
                    rev: 0,
                    dirty: true,
                    deleted: false,
                },
            )?;
        }
    }
    drop(conn);
    push_dirty(app, rt, target, vault_root, db_path).await?;
    let _ = app.emit("vault-changed", ());
    Ok(())
}
