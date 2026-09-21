use crate::caption::{format_caption, parse_caption, NoteMeta};
use crate::db::{self, NoteRow};
use crate::vault;
use grammers_client::client::{LoginToken, PasswordToken};
use grammers_client::media::Media;
use grammers_client::message::InputMessage;
use grammers_client::peer::Peer;
use grammers_client::update::Update;
use grammers_client::{Client, SignInError};
use grammers_mtsender::{SenderPool, SenderPoolFatHandle, UpdatesConfiguration};
use grammers_session::storages::SqliteSession;
use grammers_session::updates::UpdatesLike;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StorageTarget {
    SavedMessages,
    Chat { id: i64, name: String },
}

impl Default for StorageTarget {
    fn default() -> Self {
        Self::SavedMessages
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatOption {
    pub id: i64,
    pub name: String,
    pub kind: String,
}

pub struct TgRuntime {
    pub client: Client,
    pub handle: SenderPoolFatHandle,
    pub updates: Option<mpsc::Receiver<UpdatesLike>>,
    pub login_token: Option<LoginToken>,
    pub password_token: Option<PasswordToken>,
}

pub type SharedTg = Arc<Mutex<Option<TgRuntime>>>;

pub async fn connect(session_path: &Path, api_id: i32) -> Result<TgRuntime, String> {
    if let Some(parent) = session_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let session = Arc::new(
        SqliteSession::open(session_path)
            .await
            .map_err(|e| e.to_string())?,
    );
    let SenderPool {
        runner,
        handle,
        updates,
    } = SenderPool::new(Arc::clone(&session), api_id);
    let client = Client::new(handle.clone());
    tokio::spawn(runner.run());
    Ok(TgRuntime {
        client,
        handle,
        updates: Some(updates),
        login_token: None,
        password_token: None,
    })
}

pub async fn is_authorized(rt: &TgRuntime) -> Result<bool, String> {
    rt.client.is_authorized().await.map_err(|e| e.to_string())
}

pub async fn request_code(rt: &mut TgRuntime, phone: &str, api_hash: &str) -> Result<(), String> {
    let token = rt
        .client
        .request_login_code(phone, api_hash)
        .await
        .map_err(|e| e.to_string())?;
    rt.login_token = Some(token);
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct SignInResult {
    pub ok: bool,
    pub needs_password: bool,
    pub password_hint: Option<String>,
    pub name: Option<String>,
}

pub async fn sign_in_code(rt: &mut TgRuntime, code: &str) -> Result<SignInResult, String> {
    let token = rt
        .login_token
        .as_ref()
        .ok_or_else(|| "request a login code first".to_string())?;
    match rt.client.sign_in(token, code).await {
        Ok(user) => Ok(SignInResult {
            ok: true,
            needs_password: false,
            password_hint: None,
            name: user.first_name().map(|s| s.to_string()),
        }),
        Err(SignInError::PasswordRequired(password_token)) => {
            let hint = password_token.hint().map(|s| s.to_string());
            rt.password_token = Some(password_token);
            Ok(SignInResult {
                ok: false,
                needs_password: true,
                password_hint: hint,
                name: None,
            })
        }
        Err(SignInError::InvalidCode) => Err("that code is not valid".into()),
        Err(e) => Err(e.to_string()),
    }
}

pub async fn sign_in_password(rt: &mut TgRuntime, password: &str) -> Result<SignInResult, String> {
    let token = rt
        .password_token
        .take()
        .ok_or_else(|| "password not requested".to_string())?;
    match rt.client.check_password(token, password.as_bytes()).await {
        Ok(user) => Ok(SignInResult {
            ok: true,
            needs_password: false,
            password_hint: None,
            name: user.first_name().map(|s| s.to_string()),
        }),
        Err(SignInError::InvalidPassword(token)) => {
            rt.password_token = Some(token);
            Err("that password is not valid".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

pub async fn me_name(rt: &TgRuntime) -> Result<Option<String>, String> {
    let user = rt.client.get_me().await.map_err(|e| e.to_string())?;
    Ok(user.first_name().map(|s| s.to_string()))
}

pub async fn list_chats(rt: &TgRuntime) -> Result<Vec<ChatOption>, String> {
    let mut dialogs = rt.client.iter_dialogs();
    let mut out = vec![ChatOption {
        id: 0,
        name: "Saved Messages".into(),
        kind: "saved".into(),
    }];
    while let Some(dialog) = dialogs.next().await.map_err(|e| e.to_string())? {
        let peer = dialog.peer();
        let kind = match peer {
            Peer::User(_) => "user",
            Peer::Group(_) => "group",
            Peer::Channel(_) => "channel",
            Peer::Community(_) => "community",
        };
        out.push(ChatOption {
            id: peer.id().bot_api_dialog_id_unchecked(),
            name: peer.name().unwrap_or_default().to_string(),
            kind: kind.into(),
        });
        if out.len() > 80 {
            break;
        }
    }
    Ok(out)
}

async fn resolve_peer(rt: &TgRuntime, target: &StorageTarget) -> Result<Peer, String> {
    match target {
        StorageTarget::SavedMessages => {
            let me = rt.client.get_me().await.map_err(|e| e.to_string())?;
            Ok(Peer::User(me))
        }
        StorageTarget::Chat { id, .. } => {
            let mut dialogs = rt.client.iter_dialogs();
            while let Some(dialog) = dialogs.next().await.map_err(|e| e.to_string())? {
                let peer = dialog.peer().clone();
                if peer.id().bot_api_dialog_id_unchecked() == *id {
                    return Ok(peer);
                }
            }
            Err("chosen chat is not in the dialog list".into())
        }
    }
}

async fn peer_ref(peer: &Peer) -> Result<grammers_session::types::PeerRef, String> {
    peer.to_ref()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "cannot resolve peer".into())
}

pub async fn push_note(
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    relative: &str,
    existing_id: Option<i32>,
    meta: &NoteMeta,
) -> Result<i32, String> {
    let abs = vault::abs_in_vault(vault_root, relative)?;
    if !abs.exists() {
        return Err(format!("missing local file {relative}"));
    }
    let uploaded = rt
        .client
        .upload_file(&abs)
        .await
        .map_err(|e| e.to_string())?;
    let caption = format_caption(meta);
    let peer = resolve_peer(rt, target).await?;
    let peer = peer_ref(&peer).await?;
    let msg = InputMessage::new()
        .mime_type("text/markdown")
        .text(caption)
        .document(uploaded);

    if let Some(id) = existing_id {
        match rt.client.edit_message(peer, id, msg.clone()).await {
            Ok(()) => return Ok(id),
            Err(e) => {
                log::warn!("edit failed, sending a new document: {e}");
                let _ = rt.client.delete_messages(peer, &[id]).await;
            }
        }
    }

    let sent = rt
        .client
        .send_message(peer, msg)
        .await
        .map_err(|e| e.to_string())?;
    Ok(sent.id())
}

pub async fn download_note(
    rt: &TgRuntime,
    vault_root: &Path,
    relative: &str,
    media: &Media,
) -> Result<(), String> {
    let abs = vault::abs_in_vault(vault_root, relative)?;
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    rt.client
        .download_media(media, &abs)
        .await
        .map_err(|e| e.to_string())
}

pub async fn scan_remote(
    rt: &TgRuntime,
    target: &StorageTarget,
    vault_root: &Path,
    db_path: &Path,
    allow_inbox: bool,
) -> Result<usize, String> {
    let peer = resolve_peer(rt, target).await?;
    let peer = peer_ref(&peer).await?;
    let mut messages = rt.client.iter_messages(peer);
    let mut seen: std::collections::HashMap<String, (i32, NoteMeta, Option<Media>)> =
        std::collections::HashMap::new();
    let mut inbox: Vec<(i32, String)> = Vec::new();
    let mut scanned = 0usize;

    while let Some(message) = messages.next().await.map_err(|e| e.to_string())? {
        scanned += 1;
        if scanned > 2000 {
            break;
        }
        let caption = message.text().to_string();
        if let Some(meta) = parse_caption(&caption) {
            let media = message.media();
            let entry = seen.entry(meta.path.clone()).or_insert_with(|| {
                (message.id(), meta.clone(), media.clone())
            });
            if meta.rev >= entry.1.rev {
                *entry = (message.id(), meta, media);
            }
            continue;
        }
        if allow_inbox {
            if let StorageTarget::Chat { .. } = target {
                if !caption.trim().is_empty() && message.media().is_none() {
                    inbox.push((message.id(), caption));
                }
            }
        }
    }

    let mut downloads = Vec::new();
    {
        let conn = db::open(db_path)?;
        for (id, caption) in inbox {
            ingest_inbox(vault_root, &conn, id, &caption)?;
        }
        for (path, (message_id, meta, media)) in &seen {
            if meta.deleted {
                let abs = vault::abs_in_vault(vault_root, path)?;
                if abs.exists() {
                    let _ = std::fs::remove_file(&abs);
                }
                db::upsert(
                    &conn,
                    &NoteRow {
                        path: path.clone(),
                        message_id: Some(*message_id),
                        hash: meta.hash.clone(),
                        rev: meta.rev,
                        dirty: false,
                        deleted: true,
                    },
                )?;
                continue;
            }
            let row = db::get(&conn, path)?;
            if row.as_ref().map(|r| r.dirty).unwrap_or(false) {
                continue;
            }
            let local = vault::abs_in_vault(vault_root, path)?;
            let local_hash = if local.exists() {
                Some(crate::caption::content_hash(
                    &std::fs::read(&local).map_err(|e| e.to_string())?,
                ))
            } else {
                None
            };
            if local_hash.as_deref() != Some(meta.hash.as_str()) {
                if let Some(media) = media {
                    downloads.push((path.clone(), media.clone()));
                }
            }
            db::upsert(
                &conn,
                &NoteRow {
                    path: path.clone(),
                    message_id: Some(*message_id),
                    hash: meta.hash.clone(),
                    rev: meta.rev,
                    dirty: false,
                    deleted: false,
                },
            )?;
        }
    }

    let mut applied = 0usize;
    for (path, media) in downloads {
        download_note(rt, vault_root, &path, &media).await?;
        applied += 1;
    }
    Ok(applied)
}

fn ingest_inbox(
    vault_root: &Path,
    conn: &rusqlite::Connection,
    message_id: i32,
    text: &str,
) -> Result<(), String> {
    let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M").to_string();
    let rel = format!("Inbox/{stamp}.md");
    if db::get(conn, &rel)?.is_some() {
        return Ok(());
    }
    let body = format!("# Inbox\n\n{text}\n");
    let abs = vault::abs_in_vault(vault_root, &rel)?;
    vault::write_note(&abs, &body)?;
    let hash = crate::caption::content_hash(body.as_bytes());
    db::upsert(
        conn,
        &NoteRow {
            path: rel,
            message_id: Some(message_id),
            hash,
            rev: 1,
            dirty: true,
            deleted: false,
        },
    )
}

pub fn spawn_updates(
    app: AppHandle,
    client: Client,
    updates: mpsc::Receiver<UpdatesLike>,
    target: StorageTarget,
    vault_root: PathBuf,
    db_path: PathBuf,
    allow_inbox: bool,
) {
    tokio::spawn(async move {
        let mut stream = match client
            .stream_updates(updates, UpdatesConfiguration { catch_up: true })
            .await
        {
            Ok(s) => s,
            Err(e) => {
                let _ = app.emit("sync-status", SyncStatusEvent::error(e.to_string()));
                return;
            }
        };

        loop {
            match stream.next().await {
                Ok(Update::NewMessage(message)) | Ok(Update::MessageEdited(message)) => {
                    let caption = message.text().to_string();
                    if let Some(meta) = parse_caption(&caption) {
                        if let Err(e) = apply_remote_note(
                            &app,
                            &client,
                            &vault_root,
                            &db_path,
                            message.id(),
                            meta,
                            message.media(),
                        )
                        .await
                        {
                            let _ = app.emit("sync-status", SyncStatusEvent::error(e));
                        }
                    } else if allow_inbox {
                        if let StorageTarget::Chat { .. } = target {
                            if let Ok(conn) = db::open(&db_path) {
                                let _ = ingest_inbox(&vault_root, &conn, message.id(), &caption);
                                let _ = app.emit("vault-changed", ());
                            }
                        }
                    }
                }
                Ok(_) => {}
                Err(e) => {
                    let _ = app.emit("sync-status", SyncStatusEvent::error(e.to_string()));
                    break;
                }
            }
        }
    });
}

async fn apply_remote_note(
    app: &AppHandle,
    client: &Client,
    vault_root: &Path,
    db_path: &Path,
    message_id: i32,
    meta: NoteMeta,
    media: Option<Media>,
) -> Result<(), String> {
    let (dirty, local_hash) = {
        let conn = db::open(db_path)?;
        let row = db::get(&conn, &meta.path)?;
        (row.as_ref().map(|r| r.dirty).unwrap_or(false), row.map(|r| r.hash))
    };
    if dirty {
        if local_hash.as_deref() != Some(meta.hash.as_str()) {
            if let Some(media) = media {
                let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
                let stem = meta.path.trim_end_matches(".md");
                let conflict = format!("{stem} (conflict {stamp}).md");
                download_note_with(client, vault_root, &conflict, &media).await?;
                let _ = app.emit(
                    "conflict",
                    serde_json::json!({ "path": meta.path, "conflict_path": conflict }),
                );
            }
        }
        return Ok(());
    }

    if meta.deleted {
        let abs = vault::abs_in_vault(vault_root, &meta.path)?;
        if abs.exists() {
            let _ = std::fs::remove_file(abs);
        }
        let conn = db::open(db_path)?;
        db::upsert(
            &conn,
            &NoteRow {
                path: meta.path.clone(),
                message_id: Some(message_id),
                hash: meta.hash,
                rev: meta.rev,
                dirty: false,
                deleted: true,
            },
        )?;
        let _ = app.emit("note-deleted", meta.path);
        return Ok(());
    }

    if let Some(media) = media {
        download_note_with(client, vault_root, &meta.path, &media).await?;
    }
    let conn = db::open(db_path)?;
    db::upsert(
        &conn,
        &NoteRow {
            path: meta.path.clone(),
            message_id: Some(message_id),
            hash: meta.hash,
            rev: meta.rev,
            dirty: false,
            deleted: false,
        },
    )?;
    let _ = app.emit("note-changed", meta.path);
    Ok(())
}

async fn download_note_with(
    client: &Client,
    vault_root: &Path,
    relative: &str,
    media: &Media,
) -> Result<(), String> {
    let abs = vault::abs_in_vault(vault_root, relative)?;
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    client
        .download_media(media, &abs)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
pub struct SyncStatusEvent {
    pub state: String,
    pub detail: Option<String>,
}

impl SyncStatusEvent {
    pub fn error(detail: String) -> Self {
        Self {
            state: "error".into(),
            detail: Some(detail),
        }
    }
}
