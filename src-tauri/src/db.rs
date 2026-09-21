use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteRow {
    pub path: String,
    pub message_id: Option<i32>,
    pub hash: String,
    pub rev: u64,
    pub dirty: bool,
    pub deleted: bool,
}

pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            path TEXT PRIMARY KEY,
            message_id INTEGER,
            hash TEXT NOT NULL DEFAULT '',
            rev INTEGER NOT NULL DEFAULT 1,
            dirty INTEGER NOT NULL DEFAULT 0,
            deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn upsert(conn: &Connection, row: &NoteRow) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notes (path, message_id, hash, rev, dirty, deleted)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(path) DO UPDATE SET
            message_id=excluded.message_id,
            hash=excluded.hash,
            rev=excluded.rev,
            dirty=excluded.dirty,
            deleted=excluded.deleted",
        params![
            row.path,
            row.message_id,
            row.hash,
            row.rev as i64,
            row.dirty as i64,
            row.deleted as i64
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get(conn: &Connection, path: &str) -> Result<Option<NoteRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT path, message_id, hash, rev, dirty, deleted FROM notes WHERE path = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![path]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(map_row(&row)?))
    } else {
        Ok(None)
    }
}

pub fn all(conn: &Connection) -> Result<Vec<NoteRow>, String> {
    let mut stmt = conn
        .prepare("SELECT path, message_id, hash, rev, dirty, deleted FROM notes")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([], |row| Ok(map_row(row).unwrap()))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in iter {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn dirty_paths(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT path FROM notes WHERE dirty = 1 AND deleted = 0")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in iter {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn remove(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn map_row(row: &rusqlite::Row<'_>) -> Result<NoteRow, String> {
    Ok(NoteRow {
        path: row.get(0).map_err(|e| e.to_string())?,
        message_id: row.get(1).map_err(|e| e.to_string())?,
        hash: row.get(2).map_err(|e| e.to_string())?,
        rev: row.get::<_, i64>(3).map_err(|e| e.to_string())? as u64,
        dirty: row.get::<_, i64>(4).map_err(|e| e.to_string())? != 0,
        deleted: row.get::<_, i64>(5).map_err(|e| e.to_string())? != 0,
    })
}
