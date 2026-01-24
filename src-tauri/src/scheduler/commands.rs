use tauri::State;

use super::{SchedulerState, TaskPayload};
use super::notification_manager::{acknowledge_task as acknowledge_pending_task, get_pending_notifications};

#[tauri::command]
pub async fn get_pending_tasks(state: State<'_, SchedulerState>) -> Result<Vec<TaskPayload>, String> {
    Ok(get_pending_notifications(&state.pending_notifications))
}

#[tauri::command]
pub async fn acknowledge_task(
    state: State<'_, SchedulerState>,
    task_id: String,
) -> Result<(), String> {
    acknowledge_pending_task(&state.pending_notifications, &task_id, &state.vault_path)
        .await
        .map_err(|error| format!("{:?}", error))
}

#[tauri::command]
pub async fn set_window_visibility(
    state: State<'_, SchedulerState>,
    is_visible: bool,
) -> Result<(), String> {
    state.set_window_visible(is_visible);
    Ok(())
}

fn get_pending_tasks_internal(state: &SchedulerState) -> Vec<TaskPayload> {
    get_pending_notifications(&state.pending_notifications)
}

async fn acknowledge_task_internal(state: &SchedulerState, task_id: &str) -> Result<(), String> {
    acknowledge_pending_task(&state.pending_notifications, task_id, &state.vault_path)
        .await
        .map_err(|error| format!("{:?}", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::fs;
    use std::path::Path;

    proptest! {
        #[test]
        fn visibility_state_update(visible in any::<bool>()) {
            let state = SchedulerState::new("test".into());
            state.set_window_visible(visible);
            prop_assert_eq!(state.is_window_visible(), visible);
        }
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let base = std::env::temp_dir().join("lumina_scheduler_commands");
        let _ = fs::create_dir_all(&base);
        base.join(name)
    }

    fn write_task(dir: &Path, id: &str) {
        let _ = fs::create_dir_all(dir);
        let meta = serde_json::json!({
            "id": id,
            "title": "title",
            "type": "TASK",
            "recurrence": {
                "enabled": true,
                "type": "interval",
                "intervalMinutes": 5
            }
        });
        let _ = fs::write(dir.join("meta.json"), serde_json::to_vec(&meta).unwrap());
        let _ = fs::write(dir.join("prompt.md"), "prompt");
    }

    #[test]
    fn get_pending_tasks_serializes() {
        let root = temp_dir("pending_serializes");
        let _ = fs::remove_dir_all(&root);
        let task_dir = root.join("task");
        write_task(&task_dir, "task-1");
        let state = SchedulerState::new(root);
        let cached = super::super::CachedTask {
            id: "task-1".to_string(),
            last_notified: 0,
            interval_minutes: 5,
            file_path: task_dir,
        };
        state.pending_notifications.insert(cached.id.clone(), cached);
        let tasks = get_pending_tasks_internal(&state);
        let serialized = serde_json::to_string(&tasks).unwrap();
        assert!(serialized.contains("task-1"));
    }

    #[test]
    fn acknowledge_task_errors_on_missing_id() {
        let root = temp_dir("ack_error");
        let _ = fs::create_dir_all(&root);
        let state = SchedulerState::new(root);
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let result = runtime.block_on(acknowledge_task_internal(&state, "missing"));
        assert!(result.is_err());
    }
}
