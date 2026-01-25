use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use serde_json::{Map, Value};
use sysinfo::{ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn verify_single_process(app: AppHandle) -> Result<Value, String> {
    let mut sys = System::new();
    sys.refresh_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::new()),
    );

    let mut lumina_count = 0i64;
    let mut node_count = 0i64;
    let mut other_sidecars = 0i64;
    let mut lumina_pids: HashSet<sysinfo::Pid> = HashSet::new();

    for (_pid, proc_) in sys.processes() {
        let name = proc_.name().to_string().to_string();
        let lower = name.to_lowercase();
        if lower.contains("lumina") {
            lumina_count += 1;
            lumina_pids.insert(proc_.pid());
        }
    }

    for (_pid, proc_) in sys.processes() {
        let name = proc_.name().to_string().to_string();
        let lower = name.to_lowercase();
        let parent = proc_.parent();
        let is_child_of_lumina = parent.map(|pid| lumina_pids.contains(&pid)).unwrap_or(false);
        if lower.contains("node") && is_child_of_lumina {
            node_count += 1;
        } else if lower.contains("sidecar") && is_child_of_lumina {
            other_sidecars += 1;
        }
    }

    let only_lumina = lumina_count > 0 && node_count == 0 && other_sidecars == 0;

    let mut data = Map::new();
    data.insert("luminaCount".to_string(), Value::from(lumina_count));
    data.insert("nodeCount".to_string(), Value::from(node_count));
    data.insert("otherSidecars".to_string(), Value::from(other_sidecars));
    data.insert("onlyLumina".to_string(), Value::from(only_lumina));

    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if fs::create_dir_all(&dir).is_ok() {
        let path = dir.join("single-process.json");
        let _ = fs::write(&path, serde_json::to_vec_pretty(&Value::Object(data.clone())).unwrap_or_default());
    }

    Ok(Value::Object(data))
}
