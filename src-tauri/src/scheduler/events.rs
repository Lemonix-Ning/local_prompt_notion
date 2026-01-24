use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::{SchedulerMode, TaskPayload};

#[derive(Debug)]
pub enum EmitError {
    Tauri(tauri::Error),
}

impl From<tauri::Error> for EmitError {
    fn from(value: tauri::Error) -> Self {
        Self::Tauri(value)
    }
}

pub trait EventEmitter {
    fn emit_payload<T: Serialize>(&self, event: &str, payload: &T) -> Result<(), EmitError>;
}

impl EventEmitter for AppHandle {
    fn emit_payload<T: Serialize>(&self, event: &str, payload: &T) -> Result<(), EmitError> {
        self.emit(event, payload)?;
        Ok(())
    }
}

pub fn emit_task_due(app_handle: &AppHandle, task: &TaskPayload) -> Result<(), EmitError> {
    emit_task_due_with(app_handle, task)
}

pub fn emit_task_due_with<E: EventEmitter>(emitter: &E, task: &TaskPayload) -> Result<(), EmitError> {
    emitter.emit_payload("task_due", task)?;
    Ok(())
}

pub fn emit_scheduler_mode_change(app_handle: &AppHandle, mode: SchedulerMode) -> Result<(), EmitError> {
    app_handle.emit("scheduler_mode_change", mode.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use serde_json::Value;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct MockEmitter {
        events: Arc<Mutex<Vec<(String, Value)>>>,
    }

    impl EventEmitter for MockEmitter {
        fn emit_payload<T: Serialize>(&self, event: &str, payload: &T) -> Result<(), EmitError> {
            let value = serde_json::to_value(payload).unwrap();
            self.events.lock().unwrap().push((event.to_string(), value));
            Ok(())
        }
    }

    proptest! {
        #[test]
        fn event_emission_on_due(id in "[a-zA-Z0-9_-]{1,12}") {
            let emitter = MockEmitter::default();
            let task = TaskPayload {
                id: id.clone(),
                meta: serde_json::json!({ "id": id.clone(), "title": "title" }),
                content: "prompt".to_string(),
                path: "path".to_string(),
            };
            emit_task_due_with(&emitter, &task).unwrap();
            let events = emitter.events.lock().unwrap();
            prop_assert_eq!(events.len(), 1);
            prop_assert_eq!(events[0].0.as_str(), "task_due");
        }
    }
}
