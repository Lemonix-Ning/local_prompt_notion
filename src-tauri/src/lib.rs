use std::fs;
use std::path::Path;
use std::sync::Mutex;

use tauri::Manager;
use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

struct BackendProcess(Mutex<Option<CommandChild>>);

// 🔥 退出应用命令
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    println!("User requested exit from frontend");
    app.exit(0);
}

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
    // 🔥 单实例插件：如果已有实例运行，激活已有窗口而不是启动新实例
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      println!("Another instance tried to start, focusing existing window...");
      // 激活已有窗口
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    // 🔥 通知插件：支持系统级任务提醒
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![exit_app])
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

      // 创建系统托盘菜单
      let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

      // 创建系统托盘图标
      let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("PromptManager - 提示词管理器")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id.as_ref() {
            "show" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
            "quit" => {
              println!("User requested quit from tray menu");
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

      // 拦截窗口关闭事件 - 通过 run 事件处理
      // 注意：Tauri 2.x 中窗口关闭事件需要在 run 回调中处理

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    match event {
      // 🔥 移除窗口关闭拦截，让前端的 handleClose 处理关闭逻辑
      // 如果用户直接点击窗口的 X 按钮（非自定义标题栏），则隐藏窗口
      tauri::RunEvent::WindowEvent { label, event: win_event, .. } => {
        if label == "main" {
          if let tauri::WindowEvent::CloseRequested { api, .. } = win_event {
            // 阻止默认关闭行为，隐藏窗口到托盘
            // 注意：这只会在用户绕过自定义标题栏直接关闭窗口时触发
            api.prevent_close();
            if let Some(window) = app_handle.get_webview_window("main") {
              let _ = window.hide();
            }
          }
        }
      }
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
