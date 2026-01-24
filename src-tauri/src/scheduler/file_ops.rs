use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use fs2::FileExt;
use serde_json::Value;

pub fn atomic_write(path: &Path, data: &[u8]) -> Result<(), io::Error> {
    let temp_path = temp_path(path);
    let mut file = OpenOptions::new().create(true).write(true).truncate(true).open(&temp_path)?;
    file.write_all(data)?;
    file.sync_all()?;
    fs::rename(temp_path, path)?;
    Ok(())
}

pub fn acquire_file_lock(file: &File) -> Result<(), io::Error> {
    file.lock_exclusive()
}

pub fn update_last_notified_only(path: &Path, timestamp: i64) -> Result<(), io::Error> {
    let file = OpenOptions::new().read(true).write(true).open(path)?;
    acquire_file_lock(&file)?;
    let meta: Value = serde_json::from_reader(&file)?;
    validate_meta(&meta)?;
    let mut updated = meta;
    if let Some(obj) = updated.as_object_mut() {
        obj.insert("last_notified".to_string(), serde_json::json!(timestamp));
    }
    let data = serde_json::to_vec(&updated)?;
    atomic_write(path, &data)?;
    Ok(())
}

fn validate_meta(meta: &Value) -> Result<(), io::Error> {
    let has_id = meta.get("id").is_some();
    let has_type = meta.get("type").is_some();
    if has_id && has_type {
        Ok(())
    } else {
        Err(io::Error::new(io::ErrorKind::InvalidData, "invalid meta.json"))
    }
}

fn temp_path(path: &Path) -> PathBuf {
    let mut path = path.to_path_buf();
    let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    let suffix = if extension.is_empty() { "tmp" } else { "tmp" };
    path.set_extension(suffix);
    path
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        let base = std::env::temp_dir().join("lumina_scheduler_fileops");
        let _ = fs::create_dir_all(&base);
        base.join(name)
    }

    #[test]
    fn atomic_write_overwrites() {
        let path = temp_file("atomic.json");
        let _ = fs::remove_file(&path);
        atomic_write(&path, b"{\"id\":1}").unwrap();
        atomic_write(&path, b"{\"id\":2}").unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("\"id\":2"));
    }

    #[test]
    fn update_last_notified_requires_valid_json() {
        let path = temp_file("invalid.json");
        let _ = fs::write(&path, b"{\"title\":\"x\"}");
        let result = update_last_notified_only(&path, 1);
        assert!(result.is_err());
    }

    #[test]
    fn acquire_file_lock_works() {
        let path = temp_file("lock.json");
        let _ = fs::write(&path, b"{\"id\":\"x\",\"type\":\"TASK\"}");
        let file = OpenOptions::new().read(true).write(true).open(&path).unwrap();
        acquire_file_lock(&file).unwrap();
    }
}
