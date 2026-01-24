use std::fs;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use log::error;
use serde_json::Value;

use super::{CachedTask, SchedulerState};

#[derive(Debug)]
pub enum ScanError {
    Io(io::Error),
}

impl From<io::Error> for ScanError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

#[derive(Debug)]
pub enum ParseError {
    Io(io::Error),
    Json(serde_json::Error),
    InvalidData,
}

impl From<io::Error> for ParseError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for ParseError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

pub fn scan_vault(vault_path: &Path) -> Result<Vec<CachedTask>, ScanError> {
    let mut tasks = Vec::new();
    scan_dir(vault_path, &mut tasks)?;
    Ok(tasks)
}

pub fn should_rescan(vault_path: &Path, last_scan_timestamp: u64) -> Result<bool, io::Error> {
    let modified = vault_modified_timestamp(vault_path)?;
    Ok(modified > last_scan_timestamp)
}

pub fn refresh_cache_if_needed(state: &SchedulerState) -> Result<Vec<CachedTask>, ScanError> {
    let should = should_rescan(&state.vault_path, state.last_scan_timestamp())?;
    if should {
        let tasks = scan_vault(&state.vault_path)?;
        update_cache(&state.task_cache, &tasks);
        let new_ts = vault_modified_timestamp(&state.vault_path)?;
        state.set_last_scan_timestamp(new_ts);
        return Ok(tasks);
    }
    Ok(state.task_cache.iter().map(|entry| entry.value().clone()).collect())
}

fn scan_dir(path: &Path, tasks: &mut Vec<CachedTask>) -> Result<(), ScanError> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }
        if should_skip_dir(&entry_path) {
            continue;
        }
        let meta_path = entry_path.join("meta.json");
        if meta_path.exists() {
            match parse_task_minimal(&entry_path) {
                Ok(Some(task)) => tasks.push(task),
                Ok(None) => {}
                Err(err) => {
                    error!("task_scanner error: {:?}", err);
                }
            }
        } else {
            scan_dir(&entry_path, tasks)?;
        }
    }
    Ok(())
}

fn should_skip_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.starts_with('.') || name == "trash" || name == "assets")
        .unwrap_or(false)
}

fn parse_task_minimal(task_dir: &Path) -> Result<Option<CachedTask>, ParseError> {
    let meta_path = task_dir.join("meta.json");
    let data = fs::read(&meta_path)?;
    let meta: Value = serde_json::from_slice(&data)?;
    if !is_interval_task_fast(&meta) {
        return Ok(None);
    }
    let id = meta.get("id").and_then(|value| value.as_str()).ok_or(ParseError::InvalidData)?;
    let interval = meta
        .get("recurrence")
        .and_then(|value| value.get("intervalMinutes"))
        .and_then(|value| value.as_i64())
        .ok_or(ParseError::InvalidData)?;
    let last_notified = meta
        .get("last_notified")
        .and_then(|value| value.as_str())
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.with_timezone(&Utc).timestamp())
        .unwrap_or(0);

    Ok(Some(CachedTask {
        id: id.to_string(),
        last_notified,
        interval_minutes: interval as i32,
        file_path: task_dir.to_path_buf(),
    }))
}

fn is_interval_task_fast(meta: &Value) -> bool {
    let is_task = meta.get("type").and_then(|value| value.as_str()) == Some("TASK");
    let recurrence = meta.get("recurrence");
    let enabled = recurrence
        .and_then(|value| value.get("enabled"))
        .and_then(|value| value.as_bool())
        == Some(true);
    let recurrence_type = recurrence
        .and_then(|value| value.get("type"))
        .and_then(|value| value.as_str())
        == Some("interval");
    let interval_valid = recurrence
        .and_then(|value| value.get("intervalMinutes"))
        .and_then(|value| value.as_i64())
        .map(|value| value > 0)
        .unwrap_or(false);
    is_task && enabled && recurrence_type && interval_valid
}

fn vault_modified_timestamp(path: &Path) -> Result<u64, io::Error> {
    let metadata = fs::metadata(path)?;
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    Ok(modified.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
}

fn update_cache(cache: &DashMap<String, CachedTask>, tasks: &[CachedTask]) {
    cache.clear();
    for task in tasks {
        cache.insert(task.id.clone(), task.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::path::PathBuf;
    use std::time::Instant;

    fn temp_dir(name: &str) -> PathBuf {
        let base = std::env::temp_dir().join("lumina_scheduler_tests");
        let _ = fs::create_dir_all(&base);
        base.join(name)
    }

    fn write_meta(dir: &Path, content: &Value) {
        let _ = fs::create_dir_all(dir);
        let meta_path = dir.join("meta.json");
        let _ = fs::write(meta_path, serde_json::to_vec(content).unwrap());
    }

    fn interval_meta(id: &str, interval: i64) -> Value {
        serde_json::json!({
            "id": id,
            "type": "TASK",
            "recurrence": {
                "enabled": true,
                "type": "interval",
                "intervalMinutes": interval
            }
        })
    }

    proptest! {
        #[test]
        fn directory_exclusion_during_scanning(dir_name in ".*") {
            let root = temp_dir("dir_exclusion");
            let _ = fs::remove_dir_all(&root);
            let _ = fs::create_dir_all(&root);
            let skip_dir = root.join("trash").join(&dir_name);
            write_meta(&skip_dir, &interval_meta("skip", 5));
            let keep_dir = root.join("keep");
            write_meta(&keep_dir, &interval_meta("keep", 5));
            let tasks = scan_vault(&root).unwrap();
            prop_assert!(tasks.iter().all(|task| task.id != "skip"));
            prop_assert!(tasks.iter().any(|task| task.id == "keep"));
        }
    }

    proptest! {
        #[test]
        fn task_metadata_completeness(id in "[a-zA-Z0-9_-]{1,12}") {
            let root = temp_dir("meta_complete");
            let _ = fs::remove_dir_all(&root);
            let task_dir = root.join("task");
            write_meta(&task_dir, &interval_meta(&id, 3));
            let parsed = parse_task_minimal(&task_dir).unwrap().unwrap();
            prop_assert_eq!(parsed.id, id);
            prop_assert_eq!(parsed.interval_minutes, 3);
            prop_assert_eq!(parsed.file_path, task_dir);
        }
    }

    proptest! {
        #[test]
        fn interval_task_filtering(interval in 1i64..=120i64) {
            let root = temp_dir("filtering");
            let _ = fs::remove_dir_all(&root);
            let task_dir = root.join("task");
            write_meta(&task_dir, &interval_meta("ok", interval));
            let parsed = parse_task_minimal(&task_dir).unwrap().unwrap();
            prop_assert_eq!(parsed.id, "ok");
        }
    }

    proptest! {
        #[test]
        fn error_resilience(random_content in ".*") {
            let root = temp_dir("error_resilience");
            let _ = fs::remove_dir_all(&root);
            let bad_dir = root.join("bad");
            let _ = fs::create_dir_all(&bad_dir);
            let _ = fs::write(bad_dir.join("meta.json"), random_content.as_bytes());
            let good_dir = root.join("good");
            write_meta(&good_dir, &interval_meta("good", 5));
            let tasks = scan_vault(&root).unwrap();
            prop_assert!(tasks.iter().any(|task| task.id == "good"));
        }
    }

    proptest! {
        #[test]
        fn rescan_decision_logic(initial in 0u64..=1000u64) {
            let root = temp_dir("rescan_logic");
            let _ = fs::remove_dir_all(&root);
            let _ = fs::create_dir_all(&root);
            let decision = should_rescan(&root, initial).unwrap();
            let actual = vault_modified_timestamp(&root).unwrap() > initial;
            prop_assert_eq!(decision, actual);
        }
    }

    proptest! {
        #[test]
        fn cache_update_on_modification(interval in 1i64..=5i64) {
            let root = temp_dir("cache_update");
            let _ = fs::remove_dir_all(&root);
            let _ = fs::create_dir_all(&root);
            let state = SchedulerState::new(root.clone());
            let first = root.join("task1");
            write_meta(&first, &interval_meta("t1", interval));
            let _ = refresh_cache_if_needed(&state).unwrap();
            prop_assert!(state.task_cache.contains_key("t1"));
            let second = root.join("task2");
            write_meta(&second, &interval_meta("t2", interval));
            state.set_last_scan_timestamp(0);
            let _ = refresh_cache_if_needed(&state).unwrap();
            prop_assert!(state.task_cache.contains_key("t2"));
        }
    }

    #[test]
    fn scan_benchmark_1000_tasks() {
        let root = temp_dir("benchmark_scan");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::create_dir_all(&root);
        for index in 0..1000 {
            let dir = root.join(format!("task_{}", index));
            write_meta(&dir, &interval_meta(&format!("id_{}", index), 5));
        }
        let start = Instant::now();
        let tasks = scan_vault(&root).unwrap();
        let elapsed_ms = start.elapsed().as_millis();
        println!("scan_benchmark_ms:{}", elapsed_ms);
        assert_eq!(tasks.len(), 1000);
    }
}
