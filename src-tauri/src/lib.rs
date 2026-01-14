use std::fs;
use std::path::Path;
use std::sync::Mutex;

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
        let sample_vault = if let Ok(resource_dir) = app.path().resource_dir() {
            let resource_sample = resource_dir.join("sample-vault");
            if resource_sample.exists() {
                resource_sample
            } else {
                // 尝试可执行文件旁边的路径
                app.path().executable_dir().unwrap_or_default().join("sample-vault")
            }
        } else {
            // 尝试可执行文件旁边的路径
            app.path().executable_dir().unwrap_or_default().join("sample-vault")
        };
        
        if sample_vault.exists() {
            println!("Copying sample vault from: {:?} to {:?}", sample_vault, vault_path);
            copy_dir_all(sample_vault, vault_path)?;
            return Ok(());
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
      println!("Starting PromptManager setup...");

      // Portable default: vault next to the executable (e.g. on a USB drive).
      let vault_root = app
        .path()
        .executable_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("vault");

      if let Err(err) = std::fs::create_dir_all(&vault_root) {
        eprintln!("Failed to create vault directory: {}", err);
      }

      if let Err(err) = ensure_vault_data(&vault_root, app.handle()) {
        eprintln!("Failed to ensure vault seed data: {}", err);
      }

      // Start bundled sidecar backend (does not require system Node.js).
      println!("========================================");
      println!("Starting backend sidecar...");
      println!("========================================");
      println!("Vault root: {:?}", vault_root);
      println!("Expected sidecar name: server");
      println!("Expected sidecar path: binaries/server-x86_64-pc-windows-msvc.exe");
      
      let sidecar_result = app.shell().sidecar("server");
      
      match sidecar_result {
        Ok(command) => {
          println!("✓ Sidecar command created successfully");
          
          let spawn_result = command
            .env("PORT", "3002")
            .env("VAULT_PATH", vault_root.to_string_lossy().to_string())
            .spawn();

          match spawn_result {
            Ok((_rx, child)) => {
              app.manage(BackendProcess(Mutex::new(Some(child))));
              println!("✓ Backend server started successfully");
              println!("  - Port: 3002");
              println!("  - Vault: {:?}", vault_root);
              println!("========================================");
            }
            Err(err) => {
              eprintln!("✗ Failed to spawn backend server");
              eprintln!("  Error: {}", err);
              eprintln!("  Debug: {:?}", err);
              eprintln!("========================================");
            }
          }
        }
        Err(err) => {
          eprintln!("✗ Failed to create sidecar command");
          eprintln!("  Error: {}", err);
          eprintln!("  Debug: {:?}", err);
          eprintln!("  Hint: Check if binaries/server-x86_64-pc-windows-msvc.exe exists");
          eprintln!("========================================");
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    match event {
      tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
        println!("Application is closing, terminating backend server...");
        if let Some(state) = app_handle.try_state::<BackendProcess>() {
          if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
              println!("Killing backend process...");
              match child.kill() {
                Ok(_) => println!("Backend process terminated successfully"),
                Err(e) => eprintln!("Failed to kill backend process: {}", e),
              }
            }
          }
        }
      }
      _ => {}
    }
  });
}
