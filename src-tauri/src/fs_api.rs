use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::State;
use uuid::Uuid;

#[derive(Clone)]
pub struct VaultState(pub PathBuf);

#[derive(Serialize, Deserialize, Clone)]
pub struct PromptData {
    pub meta: Value,
    pub content: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CategoryNode {
    pub name: String,
    pub path: String,
    pub children: Vec<CategoryNode>,
    pub prompts: Vec<PromptData>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemState {
    pub root: String,
    pub categories: Vec<CategoryNode>,
    pub all_prompts: HashMap<String, PromptData>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResultDetails {
    pub index: usize,
    pub title: String,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResults {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub skipped: usize,
    pub details: Vec<ImportResultDetails>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResults {
    pub prompts: Vec<Value>,
    pub total: usize,
    pub not_found: Vec<String>,
}

#[derive(Deserialize)]
pub struct PromptCreateOptions {
    pub r#type: Option<String>,
    pub scheduled_time: Option<String>,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn title_to_slug(title: &str) -> String {
    let mut slug = title.trim().to_lowercase();
    slug = slug.replace(' ', "_");
    slug = slug
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>();
    if slug.is_empty() {
        "prompt".to_string()
    } else {
        slug
    }
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

fn atomic_write(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn read_json(path: &Path) -> Result<Value, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&data).map_err(|e| e.to_string())
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    atomic_write(path, &data)
}

fn resolve_path(root: &Path, raw: &str) -> PathBuf {
    let raw_path = Path::new(raw);
    if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        root.join(raw)
    }
}

fn ensure_within_root(path: &Path, root: &Path) -> Result<(), String> {
    let normalized = if path.exists() {
        path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
    } else {
        path.to_path_buf()
    };
    let root_norm = root
        .canonicalize()
        .unwrap_or_else(|_| root.to_path_buf());
    if !normalized.starts_with(&root_norm) {
        return Err("Invalid path".to_string());
    }
    Ok(())
}

fn read_prompt_data(prompt_path: &Path, category_path: Option<&Path>) -> Result<PromptData, String> {
    let meta_path = prompt_path.join("meta.json");
    let content_path = prompt_path.join("prompt.md");
    let mut meta = read_json(&meta_path)?;
    if let Some(obj) = meta.as_object_mut() {
        if let Some(category_path) = category_path {
            let category_str = category_path.to_string_lossy().to_string();
            let category_name = category_path
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or("")
                .to_string();
            if obj.get("category_path").is_none() {
                obj.insert("category_path".to_string(), Value::String(category_str));
            }
            if obj.get("category").is_none() && !category_name.is_empty() {
                obj.insert("category".to_string(), Value::String(category_name));
            }
        }
    }
    let content = fs::read_to_string(&content_path).unwrap_or_default();
    Ok(PromptData {
        meta,
        content,
        path: prompt_path.to_string_lossy().to_string(),
    })
}

fn load_prompts_in_directory(dir: &Path, category_path: Option<&Path>) -> Result<Vec<PromptData>, String> {
    let mut prompts = Vec::new();
    if !dir.exists() {
        return Ok(prompts);
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let path = entry.path();
        let meta_path = path.join("meta.json");
        if !meta_path.exists() {
            continue;
        }
        let prompt = read_prompt_data(&path, category_path)?;
        prompts.push(prompt);
    }
    Ok(prompts)
}

fn scan_directory(dir: &Path) -> Result<Vec<CategoryNode>, String> {
    let mut categories = Vec::new();
    if !dir.exists() {
        return Ok(categories);
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "trash" || name == "assets" {
            continue;
        }
        let path = entry.path();
        let meta_path = path.join("meta.json");
        if meta_path.exists() {
            continue;
        }
        let prompts = load_prompts_in_directory(&path, Some(&path))?;
        let children = scan_directory(&path)?;
        categories.push(CategoryNode {
            name,
            path: path.to_string_lossy().to_string(),
            children,
            prompts,
        });
    }
    Ok(categories)
}

fn collect_all_prompts(categories: &[CategoryNode]) -> Vec<PromptData> {
    let mut all = Vec::new();
    for cat in categories {
        all.extend(cat.prompts.clone());
        all.extend(collect_all_prompts(&cat.children));
    }
    all
}

fn prompt_id(meta: &Value) -> Option<String> {
    meta.get("id").and_then(|v| v.as_str()).map(|v| v.to_string())
}

fn normalize_category_path(raw: &str) -> String {
    let mut cleaned = raw.replace('\\', "/");
    let lower = cleaned.to_lowercase();
    if let Some(idx) = lower.rfind("/vault/") {
        cleaned = cleaned[(idx + 7)..].to_string();
    }
    if cleaned.len() >= 2 && cleaned.as_bytes()[1] == b':' {
        cleaned = cleaned[2..].to_string();
    }
    cleaned.trim_start_matches('/').to_string()
}

fn default_meta_map(title: &str, slug: &str, category_path: &Path, options: &PromptCreateOptions) -> Map<String, Value> {
    let mut meta = Map::new();
    meta.insert("id".to_string(), Value::String(Uuid::new_v4().to_string()));
    meta.insert("title".to_string(), Value::String(title.to_string()));
    meta.insert("slug".to_string(), Value::String(slug.to_string()));
    meta.insert("created_at".to_string(), Value::String(now_iso()));
    meta.insert("updated_at".to_string(), Value::String(now_iso()));
    meta.insert("tags".to_string(), Value::Array(Vec::new()));
    meta.insert("version".to_string(), Value::String("1.0.0".to_string()));
    meta.insert("author".to_string(), Value::String("User".to_string()));
    let mut model_config = Map::new();
    model_config.insert("default_model".to_string(), Value::String("gpt-4".to_string()));
    model_config.insert("temperature".to_string(), Value::from(0.7));
    model_config.insert("top_p".to_string(), Value::from(1.0));
    meta.insert("model_config".to_string(), Value::Object(model_config));
    meta.insert("is_favorite".to_string(), Value::Bool(false));
    meta.insert("is_pinned".to_string(), Value::Bool(false));
    let prompt_type = options.r#type.clone().unwrap_or_else(|| "NOTE".to_string());
    meta.insert("type".to_string(), Value::String(prompt_type));
    if let Some(scheduled) = options.scheduled_time.clone() {
        meta.insert("scheduled_time".to_string(), Value::String(scheduled));
    }
    let category_str = category_path.to_string_lossy().to_string();
    if !category_str.is_empty() {
        meta.insert("category_path".to_string(), Value::String(category_str));
        if let Some(name) = category_path.file_name().and_then(|v| v.to_str()) {
            meta.insert("category".to_string(), Value::String(name.to_string()));
        }
    }
    meta
}

fn write_prompt(prompt_path: &Path, meta: &Value, content: &str) -> Result<(), String> {
    ensure_dir(prompt_path)?;
    let meta_path = prompt_path.join("meta.json");
    let content_path = prompt_path.join("prompt.md");
    write_json(&meta_path, meta)?;
    atomic_write(&content_path, content.as_bytes())
}

#[tauri::command]
pub fn get_vault_root(state: State<VaultState>) -> String {
    state.0.to_string_lossy().to_string()
}

fn scan_vault_internal(root: &Path) -> Result<FileSystemState, String> {
    ensure_dir(root)?;
    let categories = scan_directory(root)?;
    let mut all_prompts = collect_all_prompts(&categories);
    let root_prompts = load_prompts_in_directory(root, Some(root))?;
    all_prompts.extend(root_prompts);
    let trash_path = root.join("trash");
    let trash_prompts = load_prompts_in_directory(&trash_path, Some(&trash_path))?;
    all_prompts.extend(trash_prompts);
    let mut map = HashMap::new();
    for prompt in all_prompts {
        if let Some(id) = prompt_id(&prompt.meta) {
            map.insert(id, prompt);
        }
    }
    Ok(FileSystemState {
        root: root.to_string_lossy().to_string(),
        categories,
        all_prompts: map,
    })
}

#[tauri::command]
pub fn scan_vault(state: State<VaultState>) -> Result<FileSystemState, String> {
    scan_vault_internal(&state.0)
}

#[tauri::command]
pub fn read_prompt(state: State<VaultState>, prompt_path: String) -> Result<PromptData, String> {
    let root = &state.0;
    let resolved = resolve_path(root, &prompt_path);
    ensure_within_root(&resolved, root)?;
    read_prompt_data(&resolved, resolved.parent())
}

#[tauri::command]
pub fn save_prompt(state: State<VaultState>, prompt: PromptData) -> Result<(), String> {
    let root = &state.0;
    let resolved = resolve_path(root, &prompt.path);
    ensure_within_root(&resolved, root)?;
    let mut meta = prompt.meta;
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("updated_at".to_string(), Value::String(now_iso()));
    }
    write_prompt(&resolved, &meta, &prompt.content)
}

#[tauri::command]
pub fn create_prompt(
    state: State<VaultState>,
    category_path: String,
    title: String,
    options: Option<PromptCreateOptions>,
) -> Result<PromptData, String> {
    let root = &state.0;
    let category_abs = resolve_path(root, &category_path);
    ensure_within_root(&category_abs, root)?;
    ensure_dir(&category_abs)?;
    let opts = options.unwrap_or(PromptCreateOptions {
        r#type: None,
        scheduled_time: None,
    });
    let slug = title_to_slug(&title);
    let mut prompt_path = category_abs.join(&slug);
    let mut counter = 1;
    while prompt_path.exists() {
        counter += 1;
        prompt_path = category_abs.join(format!("{}_{}", slug, counter));
    }
    let meta = Value::Object(default_meta_map(&title, &slug, &category_abs, &opts));
    write_prompt(&prompt_path, &meta, "")?;
    Ok(PromptData {
        meta,
        content: "".to_string(),
        path: prompt_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn delete_prompt(
    state: State<VaultState>,
    prompt_path: String,
    permanent: Option<bool>,
) -> Result<(), String> {
    let root = &state.0;
    let resolved = resolve_path(root, &prompt_path);
    ensure_within_root(&resolved, root)?;
    if permanent.unwrap_or(false) {
        fs::remove_dir_all(&resolved).map_err(|e| e.to_string())?;
        return Ok(());
    }
    let trash_path = root.join("trash");
    ensure_dir(&trash_path)?;
    let meta_path = resolved.join("meta.json");
    if meta_path.exists() {
        let mut meta = read_json(&meta_path).unwrap_or(Value::Object(Map::new()));
        if let Some(obj) = meta.as_object_mut() {
            obj.insert(
                "original_path".to_string(),
                Value::String(resolved.to_string_lossy().to_string()),
            );
        }
        let _ = write_json(&meta_path, &meta);
    }
    let prompt_name = resolved
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("prompt");
    let target = trash_path.join(format!("{}_{}", prompt_name, Utc::now().timestamp_millis()));
    match fs::rename(&resolved, &target) {
        Ok(_) => Ok(()),
        Err(err) => {
            let err_str = err.to_string();
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            for entry in fs::read_dir(&resolved).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let src = entry.path();
                let dst = target.join(entry.file_name());
                if src.is_dir() {
                    fs::create_dir_all(&dst).map_err(|e| e.to_string())?;
                } else {
                    fs::copy(&src, &dst).map_err(|e| e.to_string())?;
                }
            }
            fs::remove_dir_all(&resolved).map_err(|_| err_str)?;
            Ok(())
        }
    }
}

#[tauri::command]
pub fn restore_prompt(state: State<VaultState>, prompt_path: String) -> Result<(), String> {
    let root = &state.0;
    let resolved = resolve_path(root, &prompt_path);
    ensure_within_root(&resolved, root)?;
    let meta_path = resolved.join("meta.json");
    let mut meta = if meta_path.exists() {
        read_json(&meta_path).unwrap_or(Value::Object(Map::new()))
    } else {
        Value::Object(Map::new())
    };
    let original_path = meta
        .get("original_path")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let mut target = if let Some(original) = original_path {
        resolve_path(root, &original)
    } else {
        root.join("Restored")
    };
    if let Some(obj) = meta.as_object_mut() {
        obj.remove("original_path");
        obj.insert("category_path".to_string(), Value::String(target.to_string_lossy().to_string()));
    }
    ensure_dir(target.parent().unwrap_or(root))?;
    if target.exists() {
        let name = target
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("prompt");
        target = target
            .parent()
            .unwrap_or(root)
            .join(format!("{}_restored_{}", name, Utc::now().timestamp_millis()));
    }
    match fs::rename(&resolved, &target) {
        Ok(_) => write_json(&target.join("meta.json"), &meta),
        Err(_) => {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            for entry in fs::read_dir(&resolved).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let src = entry.path();
                let dst = target.join(entry.file_name());
                if src.is_dir() {
                    fs::create_dir_all(&dst).map_err(|e| e.to_string())?;
                } else {
                    fs::copy(&src, &dst).map_err(|e| e.to_string())?;
                }
            }
            fs::remove_dir_all(&resolved).map_err(|e| e.to_string())?;
            write_json(&target.join("meta.json"), &meta)
        }
    }
}

#[tauri::command]
pub fn create_category(state: State<VaultState>, parent_path: String, name: String) -> Result<(), String> {
    let root = &state.0;
    let parent_abs = resolve_path(root, &parent_path);
    ensure_within_root(&parent_abs, root)?;
    let new_path = parent_abs.join(&name);
    if new_path.exists() {
        return Err("Category already exists".to_string());
    }
    ensure_dir(&new_path)
}

#[tauri::command]
pub fn rename_category(state: State<VaultState>, category_path: String, new_name: String) -> Result<(), String> {
    let root = &state.0;
    let category_abs = resolve_path(root, &category_path);
    ensure_within_root(&category_abs, root)?;
    let parent = category_abs.parent().ok_or("Invalid category path")?;
    let target = parent.join(new_name);
    fs::rename(&category_abs, &target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_category(
    state: State<VaultState>,
    category_path: String,
    target_parent_path: String,
) -> Result<Value, String> {
    let root = &state.0;
    let category_abs = resolve_path(root, &category_path);
    let target_parent = resolve_path(root, &target_parent_path);
    ensure_within_root(&category_abs, root)?;
    ensure_within_root(&target_parent, root)?;
    let name = category_abs
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_string();
    let target = target_parent.join(&name);
    if target.exists() {
        return Err("Category already exists in target".to_string());
    }
    fs::rename(&category_abs, &target).map_err(|e| e.to_string())?;
    let mut map = Map::new();
    map.insert("name".to_string(), Value::String(name));
    map.insert("path".to_string(), Value::String(target.to_string_lossy().to_string()));
    Ok(Value::Object(map))
}

#[tauri::command]
pub fn delete_category(state: State<VaultState>, category_path: String) -> Result<(), String> {
    let root = &state.0;
    let category_abs = resolve_path(root, &category_path);
    ensure_within_root(&category_abs, root)?;
    let trash_path = root.join("trash");
    ensure_dir(&trash_path)?;
    let name = category_abs
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("category");
    let target = trash_path.join(format!("{}_{}", name, Utc::now().timestamp_millis()));
    fs::rename(&category_abs, &target).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_visits(visits_file: &Path) -> HashMap<String, i64> {
    if let Ok(data) = fs::read(visits_file) {
        if let Ok(parsed) = serde_json::from_slice::<HashMap<String, i64>>(&data) {
            return parsed;
        }
    }
    HashMap::new()
}

fn write_visits(visits_file: &Path, visits: &HashMap<String, i64>) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(visits).map_err(|e| e.to_string())?;
    atomic_write(visits_file, &data)
}

fn list_trash_items(trash_dir: &Path) -> Result<Vec<String>, String> {
    ensure_dir(trash_dir)?;
    let mut items = Vec::new();
    for entry in fs::read_dir(trash_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_dir() {
            items.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    Ok(items)
}

#[tauri::command]
pub fn trash_status(state: State<VaultState>, threshold: Option<i64>) -> Result<Value, String> {
    let root = &state.0;
    let trash_dir = root.join("trash");
    let visits_file = trash_dir.join(".trash-visits.json");
    let threshold = threshold.unwrap_or(10);
    let mut visits = read_visits(&visits_file);
    let items = list_trash_items(&trash_dir)?;
    visits.retain(|name, _| items.contains(name));
    let mut counts = Map::new();
    for item in &items {
        let count = visits.get(item).cloned().unwrap_or(0);
        counts.insert(item.clone(), Value::from(count));
    }
    let _ = write_visits(&visits_file, &visits);
    let mut data = Map::new();
    data.insert("threshold".to_string(), Value::from(threshold));
    data.insert("counts".to_string(), Value::Object(counts));
    Ok(Value::Object(data))
}

#[tauri::command]
pub fn trash_visit(state: State<VaultState>, threshold: Option<i64>) -> Result<Value, String> {
    let root = &state.0;
    let trash_dir = root.join("trash");
    let visits_file = trash_dir.join(".trash-visits.json");
    let threshold = threshold.unwrap_or(10);
    let mut visits = read_visits(&visits_file);
    let items = list_trash_items(&trash_dir)?;
    visits.retain(|name, _| items.contains(name));
    let mut deleted = Vec::new();
    let mut counts = Map::new();
    for item in &items {
        let next_count = visits.get(item).cloned().unwrap_or(0) + 1;
        if next_count >= threshold {
            let _ = fs::remove_dir_all(trash_dir.join(item));
            deleted.push(Value::Object({
                let mut map = Map::new();
                map.insert("name".to_string(), Value::String(item.clone()));
                map.insert("visits".to_string(), Value::from(next_count));
                map
            }));
            visits.remove(item);
        } else {
            visits.insert(item.clone(), next_count);
            counts.insert(item.clone(), Value::from(next_count));
        }
    }
    write_visits(&visits_file, &visits)?;
    let mut data = Map::new();
    data.insert("threshold".to_string(), Value::from(threshold));
    data.insert("visitedCount".to_string(), Value::from(items.len() as i64));
    data.insert("deleted".to_string(), Value::Array(deleted));
    data.insert("counts".to_string(), Value::Object(counts));
    Ok(Value::Object(data))
}

#[tauri::command]
pub fn upload_image(
    state: State<VaultState>,
    image_data: String,
    prompt_id: String,
    file_name: Option<String>,
) -> Result<Value, String> {
    let root = &state.0;
    let assets_dir = root.join("assets").join(&prompt_id);
    ensure_dir(&assets_dir)?;
    let cleaned = if let Some(idx) = image_data.find("base64,") {
        &image_data[(idx + 7)..]
    } else {
        image_data.as_str()
    };
    let bytes = STANDARD.decode(cleaned.as_bytes()).map_err(|e| e.to_string())?;
    let name = file_name.unwrap_or_else(|| format!("image_{}.png", Utc::now().timestamp_millis()));
    let file_path = assets_dir.join(&name);
    atomic_write(&file_path, &bytes)?;
    let mut data = Map::new();
    let relative = format!("assets/{}/{}", prompt_id, name);
    data.insert("path".to_string(), Value::String(relative));
    Ok(Value::Object(data))
}

#[tauri::command]
pub fn export_prompts(
    state: State<VaultState>,
    ids: Option<Vec<String>>,
    include_content: Option<bool>,
    preserve_structure: Option<bool>,
    structured_ids: Option<Vec<String>>,
    flat_ids: Option<Vec<String>>,
) -> Result<ExportResults, String> {
    let root = &state.0;
    let include_content = include_content.unwrap_or(true);
    let preserve_structure = preserve_structure.unwrap_or(false);
    let mut structured_set = structured_ids.unwrap_or_default().into_iter().collect::<std::collections::HashSet<_>>();
    let mut flat_set = flat_ids.unwrap_or_default().into_iter().collect::<std::collections::HashSet<_>>();
    let mut ids_to_export = Vec::new();
    if structured_set.is_empty() && flat_set.is_empty() {
        let list = ids.unwrap_or_default();
        if preserve_structure {
            for id in &list {
                structured_set.insert(id.clone());
            }
        } else {
            for id in &list {
                flat_set.insert(id.clone());
            }
        }
        ids_to_export = list;
    } else {
        ids_to_export.extend(structured_set.iter().cloned());
        ids_to_export.extend(flat_set.iter().cloned());
    }
    let state = scan_vault_internal(root)?;
    let mut export_items = Vec::new();
    let mut not_found = Vec::new();
    for id in ids_to_export {
        if let Some(prompt) = state.all_prompts.get(&id) {
            let mut item = Map::new();
            if let Some(title) = prompt.meta.get("title") {
                item.insert("title".to_string(), title.clone());
            }
            item.insert(
                "tags".to_string(),
                prompt.meta.get("tags").cloned().unwrap_or(Value::Array(Vec::new())),
            );
            item.insert(
                "type".to_string(),
                prompt.meta.get("type").cloned().unwrap_or(Value::String("NOTE".to_string())),
            );
            item.insert(
                "is_favorite".to_string(),
                prompt.meta.get("is_favorite").cloned().unwrap_or(Value::Bool(false)),
            );
            item.insert(
                "author".to_string(),
                prompt.meta.get("author").cloned().unwrap_or(Value::String(String::new())),
            );
            item.insert(
                "version".to_string(),
                prompt.meta.get("version").cloned().unwrap_or(Value::String("1.0.0".to_string())),
            );
            if include_content {
                item.insert("content".to_string(), Value::String(prompt.content.clone()));
            }
            let should_preserve = structured_set.contains(&id);
            if should_preserve {
                if let Some(cat_path) = prompt.meta.get("category_path").and_then(|v| v.as_str()) {
                    let mut relative = cat_path.replace('\\', "/");
                    let root_str = root.to_string_lossy().to_string().replace('\\', "/");
                    if relative.starts_with(&root_str) {
                        relative = relative[root_str.len()..].to_string();
                        if relative.starts_with('/') {
                            relative = relative[1..].to_string();
                        }
                    }
                    item.insert("category_path".to_string(), Value::String(relative));
                }
            }
            if let Some(value) = prompt.meta.get("scheduled_time") {
                item.insert("scheduled_time".to_string(), value.clone());
            }
            if let Some(value) = prompt.meta.get("recurrence") {
                item.insert("recurrence".to_string(), value.clone());
            }
            if let Some(value) = prompt.meta.get("model_config") {
                item.insert("model_config".to_string(), value.clone());
            }
            export_items.push(Value::Object(item));
        } else {
            not_found.push(id);
        }
    }
    let total = export_items.len();
    Ok(ExportResults {
        prompts: export_items,
        total,
        not_found,
    })
}

#[tauri::command]
pub fn import_prompts(
    state: State<VaultState>,
    prompts: Vec<Value>,
    category_path: Option<String>,
    conflict_strategy: Option<String>,
) -> Result<ImportResults, String> {
    let root = &state.0;
    let conflict_strategy = conflict_strategy.unwrap_or_else(|| "rename".to_string());
    let mut results = ImportResults {
        total: prompts.len(),
        success: 0,
        failed: 0,
        skipped: 0,
        details: Vec::new(),
    };
    let state_snapshot = scan_vault_internal(root)?;
    let mut existing_titles = HashMap::new();
    for prompt in state_snapshot.all_prompts.values() {
        let title = prompt.meta.get("title").and_then(|v| v.as_str()).unwrap_or("");
        let cat = prompt
            .meta
            .get("category_path")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let key = format!("{}:{}", cat, title);
        existing_titles.insert(key, prompt.path.clone());
    }
    let base_category = category_path.map(|p| resolve_path(root, &p));
    for (index, prompt_value) in prompts.iter().enumerate() {
        let title = prompt_value.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
        if title.is_empty() {
            results.failed += 1;
            results.details.push(ImportResultDetails {
                index,
                title: "(无标题)".to_string(),
                status: "failed".to_string(),
                error: Some("Title is required".to_string()),
            });
            continue;
        }
        let prompt_category = prompt_value
            .get("category_path")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let normalized = normalize_category_path(prompt_category);
        let target_category = if let Some(base) = &base_category {
            if normalized.is_empty() {
                base.clone()
            } else {
                base.join(normalized)
            }
        } else if normalized.is_empty() {
            root.join("公共")
        } else {
            root.join(normalized)
        };
        let target_category_str = target_category.to_string_lossy().to_string();
        let mut final_title = title.to_string();
        let mut key = format!("{}:{}", target_category_str, final_title);
        if existing_titles.contains_key(&key) {
            if conflict_strategy == "skip" {
                results.skipped += 1;
                results.details.push(ImportResultDetails {
                    index,
                    title: final_title.clone(),
                    status: "skipped".to_string(),
                    error: None,
                });
                continue;
            }
            if conflict_strategy == "overwrite" {
                if let Some(existing_path) = existing_titles.get(&key).cloned() {
                    let resolved = resolve_path(root, &existing_path);
                    let mut meta = read_json(&resolved.join("meta.json")).unwrap_or(Value::Object(Map::new()));
                    if let Some(obj) = meta.as_object_mut() {
                        if let Some(tags) = prompt_value.get("tags") {
                            obj.insert("tags".to_string(), tags.clone());
                        }
                        if let Some(value) = prompt_value.get("type") {
                            obj.insert("type".to_string(), value.clone());
                        }
                        if let Some(value) = prompt_value.get("model_config") {
                            obj.insert("model_config".to_string(), value.clone());
                        }
                        if let Some(value) = prompt_value.get("author") {
                            obj.insert("author".to_string(), value.clone());
                        }
                        if let Some(value) = prompt_value.get("version") {
                            obj.insert("version".to_string(), value.clone());
                        }
                        if let Some(value) = prompt_value.get("is_favorite") {
                            obj.insert("is_favorite".to_string(), value.clone());
                        }
                        obj.insert("updated_at".to_string(), Value::String(now_iso()));
                    }
                    let content = prompt_value
                        .get("content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if write_prompt(&resolved, &meta, &content).is_ok() {
                        results.success += 1;
                        results.details.push(ImportResultDetails {
                            index,
                            title: final_title.clone(),
                            status: "success".to_string(),
                            error: None,
                        });
                    } else {
                        results.failed += 1;
                        results.details.push(ImportResultDetails {
                            index,
                            title: final_title.clone(),
                            status: "failed".to_string(),
                            error: Some("Overwrite failed".to_string()),
                        });
                    }
                }
                continue;
            }
            let mut suffix = 1;
            loop {
                let candidate = format!("{} (imported {})", final_title, suffix);
                let candidate_key = format!("{}:{}", target_category_str, candidate);
                if !existing_titles.contains_key(&candidate_key) {
                    final_title = candidate;
                    key = candidate_key;
                    break;
                }
                suffix += 1;
            }
        }
        ensure_dir(&target_category)?;
        let slug = title_to_slug(&final_title);
        let mut prompt_path = target_category.join(&slug);
        let mut counter = 1;
        while prompt_path.exists() {
            counter += 1;
            prompt_path = target_category.join(format!("{}_{}", slug, counter));
        }
        let mut meta = default_meta_map(&final_title, &slug, &target_category, &PromptCreateOptions { r#type: None, scheduled_time: None });
        if let Some(tags) = prompt_value.get("tags") {
            meta.insert("tags".to_string(), tags.clone());
        }
        if let Some(value) = prompt_value.get("type") {
            meta.insert("type".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("model_config") {
            meta.insert("model_config".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("author") {
            meta.insert("author".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("version") {
            meta.insert("version".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("is_favorite") {
            meta.insert("is_favorite".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("scheduled_time") {
            meta.insert("scheduled_time".to_string(), value.clone());
        }
        if let Some(value) = prompt_value.get("recurrence") {
            meta.insert("recurrence".to_string(), value.clone());
        }
        let content = prompt_value
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if write_prompt(&prompt_path, &Value::Object(meta), &content).is_ok() {
            results.success += 1;
            results.details.push(ImportResultDetails {
                index,
                title: final_title.clone(),
                status: "success".to_string(),
                error: None,
            });
            existing_titles.insert(key, prompt_path.to_string_lossy().to_string());
        } else {
            results.failed += 1;
            results.details.push(ImportResultDetails {
                index,
                title: final_title.clone(),
                status: "failed".to_string(),
                error: Some("Write failed".to_string()),
            });
        }
    }
    Ok(results)
}
