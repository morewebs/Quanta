use serde::{Deserialize, Serialize};

pub const CAPTION_MAGIC: &str = "quanta/v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteMeta {
    pub path: String,
    pub hash: String,
    pub rev: u64,
    pub deleted: bool,
}

pub fn format_caption(meta: &NoteMeta) -> String {
    let mut s = format!(
        "{CAPTION_MAGIC}\npath: {}\nhash: {}\nrev: {}",
        meta.path, meta.hash, meta.rev
    );
    if meta.deleted {
        s.push_str("\ndeleted: true");
    }
    s
}

pub fn parse_caption(caption: &str) -> Option<NoteMeta> {
    let mut lines = caption.lines();
    if lines.next()?.trim() != CAPTION_MAGIC {
        return None;
    }
    let mut path = None;
    let mut hash = None;
    let mut rev = 1u64;
    let mut deleted = false;
    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(v) = line.strip_prefix("path:") {
            path = Some(normalize_path(v.trim()));
        } else if let Some(v) = line.strip_prefix("hash:") {
            hash = Some(v.trim().to_string());
        } else if let Some(v) = line.strip_prefix("rev:") {
            rev = v.trim().parse().ok()?;
        } else if let Some(v) = line.strip_prefix("deleted:") {
            deleted = v.trim().eq_ignore_ascii_case("true");
        }
    }
    Some(NoteMeta {
        path: path?,
        hash: hash?,
        rev,
        deleted,
    })
}

pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

pub fn content_hash(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_caption() {
        let meta = NoteMeta {
            path: "Projects/Quanta.md".into(),
            hash: "abc".into(),
            rev: 7,
            deleted: false,
        };
        let parsed = parse_caption(&format_caption(&meta)).unwrap();
        assert_eq!(parsed, meta);
    }

    #[test]
    fn ignores_foreign_captions() {
        assert!(parse_caption("hello world").is_none());
        assert!(parse_caption("").is_none());
    }

    #[test]
    fn tombstone() {
        let meta = NoteMeta {
            path: "gone.md".into(),
            hash: "x".into(),
            rev: 2,
            deleted: true,
        };
        let parsed = parse_caption(&format_caption(&meta)).unwrap();
        assert!(parsed.deleted);
    }
}
