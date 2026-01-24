use chrono::{DateTime, Duration, Utc};

use super::TaskMetadata;

pub fn check_due_tasks(tasks: &[TaskMetadata], current_time: DateTime<Utc>) -> Vec<TaskMetadata> {
    tasks
        .iter()
        .cloned()
        .filter(|task| is_task_due(task, current_time))
        .collect()
}

pub fn is_task_due(task: &TaskMetadata, current_time: DateTime<Utc>) -> bool {
    let due_time = calculate_due_time(task.last_notified, task.interval_minutes);
    current_time >= due_time
}

pub fn calculate_due_time(last_notified: Option<DateTime<Utc>>, interval_minutes: i64) -> DateTime<Utc> {
    match last_notified {
        Some(value) => value + Duration::minutes(interval_minutes),
        None => Utc::now(),
    }
}

pub fn update_last_notified_if_due(task: &mut TaskMetadata, current_time: DateTime<Utc>) -> bool {
    if is_task_due(task, current_time) {
        task.last_notified = Some(current_time);
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn sample_task(last_notified: Option<DateTime<Utc>>, interval_minutes: i64) -> TaskMetadata {
        TaskMetadata {
            id: "task".to_string(),
            title: "title".to_string(),
            prompt: "prompt".to_string(),
            last_notified,
            interval_minutes,
            file_path: "test".into(),
        }
    }

    proptest! {
        #[test]
        fn due_time_calculation(last in 0i64..=4102444800i64, interval in 1i64..=120i64) {
            let last_dt = DateTime::<Utc>::from_timestamp(last, 0).unwrap();
            let due = calculate_due_time(Some(last_dt), interval);
            prop_assert_eq!(due.timestamp(), last_dt.timestamp() + interval * 60);
        }
    }

    proptest! {
        #[test]
        fn due_task_detection(last in 0i64..=4102444800i64, interval in 1i64..=120i64, offset in 0i64..=7200i64) {
            let last_dt = DateTime::<Utc>::from_timestamp(last, 0).unwrap();
            let current = last_dt + Duration::minutes(interval) + Duration::seconds(offset);
            let task = sample_task(Some(last_dt), interval);
            prop_assert!(is_task_due(&task, current));
        }
    }

    proptest! {
        #[test]
        fn timestamp_update_on_due(last in 0i64..=4102444800i64, interval in 1i64..=120i64) {
            let last_dt = DateTime::<Utc>::from_timestamp(last, 0).unwrap();
            let current = last_dt + Duration::minutes(interval);
            let mut task = sample_task(Some(last_dt), interval);
            let updated = update_last_notified_if_due(&mut task, current);
            prop_assert!(updated);
            prop_assert_eq!(task.last_notified.unwrap().timestamp(), current.timestamp());
        }
    }
}
