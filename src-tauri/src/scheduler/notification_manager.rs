use std::fs;
use std::io;
use std::path::Path;
use std::sync::Arc;

use chrono::Utc;
use dashmap::DashMap;
use serde_json::Value;

use super::{CachedTask, TaskPayload};
use super::file_ops::update_last_notified_only;

#[allow(dead_code)]
#[derive(Debug)]
pub enum AcknowledgeError {
    Io(io::Error),
    MissingTask,
}

impl From<io::Error> for AcknowledgeError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

pub fn add_pending_notification(pending: &Arc<DashMap<String, CachedTask>>, task: CachedTask) -> bool {
    pending.insert(task.id.clone(), task).is_none()
}

pub fn get_pending_notifications(pending: &Arc<DashMap<String, CachedTask>>) -> Vec<TaskPayload> {
    pending
        .iter()
        .filter_map(|entry| load_task_payload(&entry.value().file_path).ok())
        .collect()
}

pub async fn acknowledge_task(
    pending: &Arc<DashMap<String, CachedTask>>,
    task_id: &str,
    _vault_path: &Path,
) -> Result<(), AcknowledgeError> {
    let task = pending.remove(task_id).map(|(_, value)| value).ok_or(AcknowledgeError::MissingTask)?;
    let meta_path = task.file_path.join("meta.json");
    update_last_notified_only(&meta_path, Utc::now().timestamp())?;
    Ok(())
}

fn load_task_payload(task_dir: &Path) -> Result<TaskPayload, io::Error> {
    let meta_path = task_dir.join("meta.json");
    let prompt_path = task_dir.join("prompt.md");
    let meta_value: Value = serde_json::from_slice(&fs::read(meta_path)?)?;
    let id = meta_value.get("id").and_then(|value| value.as_str()).unwrap_or_default().to_string();
    let content = fs::read_to_string(prompt_path)?;
    Ok(TaskPayload {
        id,
        meta: meta_value,
        content,
        path: task_dir.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let base = std::env::temp_dir().join("lumina_scheduler_notifications");
        let _ = fs::create_dir_all(&base);
        base.join(name)
    }

    fn write_task(dir: &Path, id: &str, interval: i64) {
        let _ = fs::create_dir_all(dir);
        let meta = serde_json::json!({
            "id": id,
            "title": "title",
            "type": "TASK",
            "recurrence": {
                "enabled": true,
                "type": "interval",
                "intervalMinutes": interval
            }
        });
        let _ = fs::write(dir.join("meta.json"), serde_json::to_vec(&meta).unwrap());
        let _ = fs::write(dir.join("prompt.md"), "prompt");
    }

    proptest! {
        #[test]
        fn pending_queue_addition(id in "[a-zA-Z0-9_-]{1,8}") {
            let pending = Arc::new(DashMap::new());
            let task = CachedTask {
                id: id.clone(),
                last_notified: 0,
                interval_minutes: 5,
                file_path: Path::new("test").to_path_buf(),
            };
            let inserted = add_pending_notification(&pending, task);
            prop_assert!(inserted);
            prop_assert!(pending.contains_key(&id));
        }
    }

    proptest! {
        #[test]
        fn no_duplicate_pending_tasks(id in "[a-zA-Z0-9_-]{1,8}") {
            let pending = Arc::new(DashMap::new());
            let task = CachedTask {
                id: id.clone(),
                last_notified: 0,
                interval_minutes: 5,
                file_path: Path::new("test").to_path_buf(),
            };
            let _ = add_pending_notification(&pending, task.clone());
            let inserted_again = add_pending_notification(&pending, task);
            prop_assert!(!inserted_again);
        }
    }

    proptest! {
        #[test]
        fn pending_queue_query(id in "[a-zA-Z0-9_-]{1,8}") {
            let root = temp_dir("query");
            let _ = fs::remove_dir_all(&root);
            let task_dir = root.join("task");
            write_task(&task_dir, &id, 3);
            let pending = Arc::new(DashMap::new());
            let cached = CachedTask {
                id: id.clone(),
                last_notified: 0,
                interval_minutes: 3,
                file_path: task_dir.clone(),
            };
            let _ = add_pending_notification(&pending, cached);
            let result = get_pending_notifications(&pending);
            prop_assert_eq!(result.len(), 1);
            prop_assert_eq!(result[0].id.as_str(), id.as_str());
        }
    }

    proptest! {
        #[test]
        fn task_acknowledgment(id in "[a-zA-Z0-9_-]{1,8}") {
            let root = temp_dir("ack");
            let _ = fs::remove_dir_all(&root);
            let task_dir = root.join("task");
            write_task(&task_dir, &id, 3);
            let pending = Arc::new(DashMap::new());
            let cached = CachedTask {
                id: id.clone(),
                last_notified: 0,
                interval_minutes: 3,
                file_path: task_dir.clone(),
            };
            let _ = add_pending_notification(&pending, cached);
            let runtime = tokio::runtime::Runtime::new().unwrap();
            let result = runtime.block_on(acknowledge_task(&pending, &id, &root));
            prop_assert!(result.is_ok());
            prop_assert!(!pending.contains_key(&id));
        }
    }
}
