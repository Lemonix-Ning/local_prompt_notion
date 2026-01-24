use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::Value;
use tauri::Manager;
use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

mod scheduler;
use scheduler::commands::{acknowledge_task, get_pending_tasks, set_window_visibility};
use scheduler::{start_scheduler, stop_scheduler};
use scheduler::SchedulerState;

struct CloseBehaviorState(Mutex<String>);

// "minimize" => hide to tray
// "exit" => exit app
fn normalize_close_behavior(value: &str) -> String {
    match value {
        "exit" => "exit".to_string(),
        _ => "minimize".to_string(),
    }
}

fn resolve_vault_root(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(value) = std::env::var("LUMINA_VAULT_PATH") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(value) = std::env::var("VAULT_PATH") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(config_dir) = app.path().app_config_dir() {
        let settings_path = config_dir.join("settings.json");
        if let Ok(data) = fs::read(&settings_path) {
            if let Ok(settings) = serde_json::from_slice::<Value>(&data) {
                if let Some(path) = settings.get("vault_path").and_then(|value| value.as_str()) {
                    if !path.trim().is_empty() {
                        return PathBuf::from(path);
                    }
                }
            }
        }
    }

    app.path()
        .executable_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("vault")
}

// 🔥 退出应用命令
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    println!("User requested exit from frontend");
    if let Some(state) = app.try_state::<SchedulerState>() {
        stop_scheduler(&state);
    }
    app.exit(0);
}

#[tauri::command]
fn set_close_behavior(app: tauri::AppHandle, behavior: String) {
    let normalized = normalize_close_behavior(&behavior);
    if let Some(state) = app.try_state::<CloseBehaviorState>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = normalized;
        }
    } else {
        app.manage(CloseBehaviorState(Mutex::new(normalized)));
    }
}

#[tauri::command]
fn get_close_behavior(app: tauri::AppHandle) -> String {
    if let Some(state) = app.try_state::<CloseBehaviorState>() {
        if let Ok(guard) = state.0.lock() {
            return normalize_close_behavior(&guard);
        }
    }
    "minimize".to_string()
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
  // 检查是否是开机自启动
  let args: Vec<String> = std::env::args().collect();
  let is_autostart = args.iter().any(|arg| arg == "--autostart" || arg == "--hidden");
  
  let app = tauri::Builder::default()
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
    .invoke_handler(tauri::generate_handler![
      exit_app,
      set_close_behavior,
      get_close_behavior,
      get_pending_tasks,
      acknowledge_task,
      set_window_visibility
    ])
    .setup(move |app| {
      // 🚀 优化：减少启动日志，加快启动速度
      #[cfg(desktop)]
      {
        use tauri_plugin_autostart::MacosLauncher;
        
        // 初始化自启动插件，直接传入参数
        let _ = app
          .handle()
          .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent, 
            Some(vec!["--autostart"])
          ));
      }

      let vault_root = resolve_vault_root(app.handle());

      // 默认关闭行为：最小化到托盘
      app.manage(CloseBehaviorState(Mutex::new("minimize".to_string())));

      if let Err(err) = std::fs::create_dir_all(&vault_root) {
        eprintln!("Failed to create vault directory: {}", err);
      }

      if let Err(err) = ensure_vault_data(&vault_root, app.handle()) {
        eprintln!("Failed to ensure vault seed data: {}", err);
      }

      let scheduler_state = SchedulerState::new(vault_root.clone());
      let scheduler_state_clone = scheduler_state.clone();
      app.manage(scheduler_state);
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let _ = start_scheduler(scheduler_state_clone, app_handle).await;
      });

      // 创建系统托盘菜单
      let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

      // 创建系统托盘图标
      let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Lumina")
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
              if let Some(state) = app.try_state::<SchedulerState>() {
                stop_scheduler(&state);
              }
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

      // 🔥 只在开机自启动时隐藏窗口
      if is_autostart {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
        }
        
        // 发送系统通知
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification()
          .builder()
          .title("Lumina 已启动")
          .body("应用已在后台运行，点击托盘图标打开")
          .show();
      }

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
            api.prevent_close();

            let behavior = if let Some(state) = app_handle.try_state::<CloseBehaviorState>() {
              state.0.lock().ok().map(|g| normalize_close_behavior(&g)).unwrap_or_else(|| "minimize".to_string())
            } else {
              "minimize".to_string()
            };

            if behavior == "exit" {
              println!("Close requested: exit");
              if let Some(state) = app_handle.try_state::<SchedulerState>() {
                stop_scheduler(&state);
              }
              app_handle.exit(0);
              return;
            }

            if let Some(window) = app_handle.get_webview_window("main") {
              let _ = window.hide();
            }
          }
        }
      }
      tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
        println!("Application is closing...");
        if let Some(state) = app_handle.try_state::<SchedulerState>() {
          stop_scheduler(&state);
        }
      }
      _ => {}
    }
  });
}
