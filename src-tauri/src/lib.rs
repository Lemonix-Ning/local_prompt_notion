use std::sync::Mutex;
use std::fs;
use std::path::Path;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

struct BackendProcess(Mutex<Option<CommandChild>>);

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn ensure_vault_data(vault_path: &Path, app: &tauri::AppHandle) -> std::io::Result<()> {
    // 如果 vault 目录不存在或为空，复制示例数据
    if !vault_path.exists() || vault_path.read_dir()?.next().is_none() {
        // 尝试从打包的资源中复制示例数据
        if let Ok(resource_dir) = app.path().resource_dir() {
            let sample_vault = resource_dir.join("sample-vault");
            if sample_vault.exists() {
                println!("Copying sample vault from resources: {:?} to {:?}", sample_vault, vault_path);
                copy_dir_all(sample_vault, vault_path)?;
                return Ok(());
            }
        }
        
        // 如果找不到示例数据，创建基本结构
        println!("Creating basic vault structure at: {:?}", vault_path);
        fs::create_dir_all(vault_path.join("Coding"))?;
        fs::create_dir_all(vault_path.join("Business"))?;
        fs::create_dir_all(vault_path.join("Creative Writing"))?;
        fs::create_dir_all(vault_path.join("trash"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Portable default: vault next to the executable (e.g. on a USB drive).
      // This makes it easy to move the whole folder and keep data together.
      let app_dir = app.path().executable_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
      let vault_root = app_dir.join("vault");

      // 确保 vault 目录存在并有初始数据
      if let Err(err) = ensure_vault_data(&vault_root, &app.handle()) {
        eprintln!("Failed to initialize vault data: {err}");
      }

      let backend = app
        .shell()
        .sidecar("server")?
        .env("PORT", "3001")
        .env("VAULT_PATH", &vault_root)
        .spawn();

      match backend {
        Ok((_rx, child)) => {
          app.manage(BackendProcess(Mutex::new(Some(child))));
        }
        Err(err) => {
          eprintln!("Failed to spawn backend sidecar: {err}");
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
      if let Some(state) = app_handle.try_state::<BackendProcess>() {
        if let Ok(mut guard) = state.0.lock() {
          if let Some(child) = guard.take() {
            let _ = child.kill();
          }
        }
      }
    }
  });
}
