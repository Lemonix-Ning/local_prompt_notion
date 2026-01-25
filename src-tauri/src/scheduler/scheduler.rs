use std::fmt;
use std::time::Instant;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
};

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tokio::time::Duration;

use super::events::emit_task_due;
use super::file_ops::update_last_notified_only;
use super::notification_manager::add_pending_notification;
use super::task_scanner::refresh_cache_if_needed;

#[derive(Debug, Clone)]
pub struct CachedTask {
    pub id: String,
    pub last_notified: i64,
    pub interval_minutes: i32,
    pub file_path: PathBuf,
}

impl CachedTask {
    #[inline]
    pub fn next_trigger_time(&self) -> i64 {
        let interval_minutes = self.interval_minutes.max(1) as i64;
        self.last_notified + (interval_minutes * 60)
    }

    #[inline]
    pub fn is_due(&self, current_time: i64) -> bool {
        current_time >= self.next_trigger_time()
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskMetadata {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub last_notified: Option<DateTime<Utc>>,
    pub interval_minutes: i64,
    pub file_path: PathBuf,
}

#[allow(dead_code)]
impl TaskMetadata {
    pub fn last_notified_timestamp(&self) -> Option<i64> {
        self.last_notified.map(|value| value.timestamp())
    }

    pub fn set_last_notified_timestamp(&mut self, timestamp: i64) {
        self.last_notified = DateTime::<Utc>::from_timestamp(timestamp, 0);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPayload {
    pub id: String,
    pub meta: Value,
    pub content: String,
    pub path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SchedulerMode {
    Idle,
    Active,
    Background,
}

impl fmt::Display for SchedulerMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SchedulerMode::Idle => write!(f, "Idle"),
            SchedulerMode::Active => write!(f, "Active"),
            SchedulerMode::Background => write!(f, "Background"),
        }
    }
}

#[derive(Clone)]
pub struct SchedulerState {
    pub pending_notifications: Arc<DashMap<String, CachedTask>>,
    pub task_cache: Arc<DashMap<String, CachedTask>>,
    pub window_visible: Arc<AtomicBool>,
    pub last_scan_timestamp: Arc<AtomicU64>,
    pub running: Arc<AtomicBool>,
    pub vault_path: PathBuf,
}

#[allow(dead_code)]
#[derive(Debug)]
pub enum SchedulerError {
    Io(std::io::Error),
}

impl From<std::io::Error> for SchedulerError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub async fn start_scheduler(state: SchedulerState, app_handle: AppHandle) -> Result<(), SchedulerError> {
    reset_interval_baselines(&state, Utc::now().timestamp());
    state.set_running(true);
    tokio::spawn(async move {
        scheduler_loop(state, app_handle).await;
    });
    Ok(())
}

async fn scheduler_loop(state: SchedulerState, app_handle: AppHandle) {
    let mut last_mode: Option<SchedulerMode> = None;
    loop {
        if !state.is_running() {
            break;
        }
        let has_tasks = !state.task_cache.is_empty();
        let mode = derive_scheduler_mode(state.is_window_visible(), has_tasks);
        if last_mode != Some(mode) {
            info!("scheduler_mode_change:{}", mode);
            last_mode = Some(mode);
        }
        let interval = calculate_tick_interval(state.is_window_visible(), has_tasks);
        if interval.is_none() {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        }
        let scan_start = Instant::now();
        let tasks = match refresh_cache_if_needed(&state) {
            Ok(value) => value,
            Err(_) => {
                tokio::time::sleep(interval.unwrap()).await;
                continue;
            }
        };
        let scan_ms = scan_start.elapsed().as_millis();
        info!("scheduler_scan_ms:{}", scan_ms);
        let now = Utc::now().timestamp();
        for task in tasks {
            if task.is_due(now) {
                let due_at = task.next_trigger_time();
                let latency = now.saturating_sub(due_at);
                info!("task_due_latency_sec:{}:{}", task.id, latency);
                let meta_path = task.file_path.join("meta.json");
                let _ = update_last_notified_only(&meta_path, now);
                if add_pending_notification(&state.pending_notifications, task.clone()) {
                    if let Some(full_task) = super::notification_manager::get_pending_notifications(&state.pending_notifications)
                        .into_iter()
                        .find(|value| value.id == task.id)
                    {
                        let _ = emit_task_due(&app_handle, &full_task);
                    }
                }
                state
                    .task_cache
                    .entry(task.id.clone())
                    .and_modify(|entry| entry.last_notified = now);
            }
        }
        tokio::time::sleep(interval.unwrap()).await;
    }
}

pub fn stop_scheduler(state: &SchedulerState) {
    state.set_running(false);
}

pub fn derive_scheduler_mode(window_visible: bool, has_tasks: bool) -> SchedulerMode {
    if !has_tasks {
        SchedulerMode::Idle
    } else if window_visible {
        SchedulerMode::Active
    } else {
        SchedulerMode::Background
    }
}

pub fn calculate_tick_interval(window_visible: bool, has_tasks: bool) -> Option<Duration> {
    match derive_scheduler_mode(window_visible, has_tasks) {
        SchedulerMode::Idle => None,
        SchedulerMode::Active => Some(Duration::from_secs(1)),
        SchedulerMode::Background => Some(Duration::from_secs(10)),
    }
}

pub fn reset_interval_baselines(state: &SchedulerState, timestamp: i64) -> usize {
    let tasks = match super::task_scanner::scan_vault(&state.vault_path) {
        Ok(value) => value,
        Err(_) => {
            state.pending_notifications.clear();
            state.task_cache.clear();
            state.set_last_scan_timestamp(0);
            return 0;
        }
    };

    state.pending_notifications.clear();
    state.task_cache.clear();
    for task in &tasks {
        let meta_path = task.file_path.join("meta.json");
        let _ = update_last_notified_only(&meta_path, timestamp);
        state.task_cache.insert(task.id.clone(), task.clone());
    }
    state.set_last_scan_timestamp(0);
    tasks.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let base = std::env::temp_dir().join("lumina_scheduler_lifecycle");
        let _ = fs::create_dir_all(&base);
        base.join(name)
    }

    #[test]
    fn startup_with_empty_vault() {
        let root = temp_dir("empty_vault");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::create_dir_all(&root);
        let state = SchedulerState::new(root);
        let reset_count = reset_interval_baselines(&state, 0);
        assert_eq!(reset_count, 0);
        assert!(state.task_cache.is_empty());
        assert!(state.pending_notifications.is_empty());
    }

    #[test]
    fn mode_transitions() {
        assert_eq!(derive_scheduler_mode(true, false), SchedulerMode::Idle);
        assert_eq!(derive_scheduler_mode(true, true), SchedulerMode::Active);
        assert_eq!(derive_scheduler_mode(false, true), SchedulerMode::Background);
    }

    #[test]
    fn shutdown_behavior() {
        let root = temp_dir("shutdown");
        let _ = fs::create_dir_all(&root);
        let state = SchedulerState::new(root);
        state.set_running(true);
        stop_scheduler(&state);
        assert!(!state.is_running());
    }
}

impl SchedulerState {
    pub fn new(vault_path: PathBuf) -> Self {
        Self {
            pending_notifications: Arc::new(DashMap::new()),
            task_cache: Arc::new(DashMap::new()),
            window_visible: Arc::new(AtomicBool::new(true)),
            last_scan_timestamp: Arc::new(AtomicU64::new(0)),
            running: Arc::new(AtomicBool::new(false)),
            vault_path,
        }
    }

    #[inline]
    pub fn is_window_visible(&self) -> bool {
        self.window_visible.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn set_window_visible(&self, visible: bool) {
        self.window_visible.store(visible, Ordering::Relaxed);
    }

    #[inline]
    pub fn last_scan_timestamp(&self) -> u64 {
        self.last_scan_timestamp.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn set_last_scan_timestamp(&self, timestamp: u64) {
        self.last_scan_timestamp.store(timestamp, Ordering::Relaxed);
    }

    #[inline]
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn set_running(&self, running: bool) {
        self.running.store(running, Ordering::Relaxed);
    }
}
